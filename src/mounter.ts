import {spawn, spawnSync} from 'node:child_process';

import {
	Plist,
	ValueDict,
	ValueArray,
	ValueString,
	ValueBoolean
} from '@shockpkg/plist-dom';

export interface IMounterOptions {
	/**
	 * The path for hdiutil.
	 *
	 * @default 'hdiutil'
	 */
	hdiutil?: string | null;
}

export interface IMounterAttachOptions {
	/**
	 * Force the devices to be read-only.
	 */
	readonly?: boolean;

	/**
	 * Hide any mounted volumes from applications like Finder.
	 */
	nobrowse?: boolean;
}

export interface IMounterEjectOptions {
	/**
	 * Forcibly detach.
	 */
	force?: boolean;
}

export interface IMounterDevice {
	/**
	 * The dev-entry hdiutil info.
	 */
	devEntry: string;

	/**
	 * The potentially-mountable hdiutil info.
	 */
	potentiallyMountable: boolean;

	/**
	 * The content-hint hdiutil info.
	 */
	contentHint?: string;

	/**
	 * The unmapped-content-hint hdiutil info.
	 */
	unmappedContentHint?: string;

	/**
	 * The volume-kind hdiutil info, if present.
	 */
	volumeKind?: string;

	/**
	 * The mount-point hdiutil info, if present.
	 */
	mountPoint?: string;
}

export interface IMounterAttachInfo {
	/**
	 * Device list.
	 */
	devices: IMounterDevice[];

	/**
	 * Eject disk.
	 */
	eject(options?: Readonly<IMounterEjectOptions> | null): Promise<void>;

	/**
	 * Eject disk.
	 */
	ejectSync(options?: Readonly<IMounterEjectOptions> | null): void;
}

/**
 * Mounter object.
 */
export class Mounter {
	/**
	 * The path to hdiutil.
	 */
	public hdiutil: string;

	/**
	 * Mounter constructor.
	 *
	 * @param options Options object.
	 */
	constructor(options: Readonly<IMounterOptions> | null = null) {
		this.hdiutil = (options ? options.hdiutil : null) || 'hdiutil';
	}

	/**
	 * Attach a disk image.
	 *
	 * @param file Path to disk image.
	 * @param options Options object.
	 * @param ejectOnExit Eject on exit options, or null.
	 * @returns Info object.
	 */
	public async attach(
		file: string,
		options: Readonly<IMounterAttachOptions> | null = null,
		ejectOnExit: Readonly<IMounterEjectOptions> | null = null
	): Promise<IMounterAttachInfo> {
		const devices = await this._runAttach(this._argsAttach(file, options));
		const {eject, ejectSync} = this._createEjects(devices);
		return {
			devices,
			eject,
			ejectSync
		};
	}

	/**
	 * Attach a disk image.
	 *
	 * @param file Path to disk image.
	 * @param options Options object.
	 * @param ejectOnExit Eject on exit options, or null.
	 * @returns Info object.
	 */
	public attachSync(
		file: string,
		options: Readonly<IMounterAttachOptions> | null = null,
		ejectOnExit: Readonly<IMounterEjectOptions> | null = null
	): IMounterAttachInfo {
		// eslint-disable-next-line no-sync
		const devices = this._runAttachSync(this._argsAttach(file, options));
		const {eject, ejectSync} = this._createEjects(devices);
		return {
			devices,
			eject,
			ejectSync
		};
	}

	/**
	 * Eject a disk image.
	 *
	 * @param file Path to device file or volume mount point.
	 * @param options Options object.
	 */
	public async eject(
		file: string,
		options: Readonly<IMounterEjectOptions> | null = null
	) {
		await this._runEject(this._argsEject(file, options));
	}

	/**
	 * Eject a disk image.
	 *
	 * @param file Path to device file or volume mount point.
	 * @param options Options object.
	 */
	public ejectSync(
		file: string,
		options: Readonly<IMounterEjectOptions> | null = null
	) {
		// eslint-disable-next-line no-sync
		this._runEjectSync(this._argsEject(file, options));
	}

	/**
	 * Create args for attach.
	 *
	 * @param file Path to disk image.
	 * @param options Options object.
	 * @returns Argument list.
	 */
	protected _argsAttach(
		file: string,
		options: Readonly<IMounterAttachOptions> | null = null
	) {
		const args = ['attach', '-plist'];
		if (options) {
			if (options.readonly) {
				args.push('-readonly');
			}
			if (options.nobrowse) {
				args.push('-nobrowse');
			}
		}
		args.push(this._fileArg(file));
		return args;
	}

	/**
	 * Create args for eject.
	 *
	 * @param file Path to device file or volume mount point.
	 * @param options Options object.
	 * @returns Argument list.
	 */
	protected _argsEject(
		file: string,
		options: Readonly<IMounterEjectOptions> | null = null
	) {
		const args = ['eject'];
		if (options && options.force) {
			args.push('-force');
		}
		args.push(this._fileArg(file));
		return args;
	}

	/**
	 * Run hdiutil attach command, returning the devices list on success.
	 *
	 * @param args CLI args.
	 * @returns Devices list.
	 */
	protected async _runAttach(args: Readonly<string[]>) {
		const stdouts: Buffer[] = [];
		const proc = spawn(this.hdiutil, args);
		proc.stdout.on('data', (data: Buffer) => {
			stdouts.push(data);
		});
		const code = await new Promise<number | null>((resolve, reject) => {
			proc.once('exit', resolve);
			proc.once('error', reject);
		});
		if (code) {
			throw new Error(`Attach failed: hdiutil exit code: ${code}`);
		}
		return this._parseDevices(Buffer.concat(stdouts).toString());
	}

	/**
	 * Run hdiutil attach command, returning the devices list on success.
	 *
	 * @param args CLI args.
	 * @returns Devices list.
	 */
	protected _runAttachSync(args: Readonly<string[]>) {
		const {status, error, stdout} = spawnSync(this.hdiutil, args);
		if (error) {
			throw error;
		}
		if (status) {
			throw new Error(`Attach failed: hdiutil exit code: ${status}`);
		}
		return this._parseDevices(stdout.toString());
	}

	/**
	 * Run hdiutil eject command.
	 *
	 * @param args CLI args.
	 */
	protected async _runEject(args: Readonly<string[]>) {
		const proc = spawn(this.hdiutil, args);
		const status = await new Promise<number | null>((resolve, reject) => {
			proc.once('exit', resolve);
			proc.once('error', reject);
		});
		if (status) {
			throw new Error(`Eject failed: hdiutil exit code: ${status}`);
		}
	}

	/**
	 * Run hdiutil eject command.
	 *
	 * @param args CLI args.
	 */
	protected _runEjectSync(args: Readonly<string[]>) {
		const {status, error} = spawnSync(this.hdiutil, args);
		if (error) {
			throw error;
		}
		if (status) {
			throw new Error(`Eject failed: hdiutil exit code: ${status}`);
		}
	}

	/**
	 * Create file argument from file path.
	 *
	 * @param file File path.
	 * @returns A path for use as argument.
	 */
	protected _fileArg(file: string) {
		// Make sure it will not be recognized as option argument.
		return file.startsWith('-') ? `./${file}` : file;
	}

	/**
	 * Parse devices plist into devices list.
	 *
	 * @param xml XML plist.
	 * @returns Devices list.
	 */
	protected _parseDevices(xml: string) {
		const plist = new Plist();
		plist.fromXml(xml);
		const systemEntities = plist
			.valueCastAs(ValueDict)
			.getValue('system-entities')
			.castAs(ValueArray);

		const r: IMounterDevice[] = [];
		for (const value of systemEntities.value) {
			const dict = value.castAs(ValueDict);
			const devEntry = dict
				.getValue('dev-entry')
				.castAs(ValueString).value;
			const potentiallyMountable = dict
				.getValue('potentially-mountable')
				.castAs(ValueBoolean).value;
			const contentHint = dict.get('content-hint');
			const unmappedContentHint = dict.get('unmapped-content-hint');
			const volumeKind = dict.get('volume-kind');
			const mountPoint = dict.get('mount-point');

			const device: IMounterDevice = {
				devEntry,
				potentiallyMountable
			};
			if (contentHint) {
				device.contentHint = contentHint.castAs(ValueString).value;
			}
			if (unmappedContentHint) {
				device.unmappedContentHint =
					unmappedContentHint.castAs(ValueString).value;
			}
			if (volumeKind) {
				device.volumeKind = volumeKind.castAs(ValueString).value;
			}
			if (mountPoint) {
				device.mountPoint = mountPoint.castAs(ValueString).value;
			}
			r.push(device);
		}
		return r;
	}

	/**
	 * Find the root device, null on empty list.
	 *
	 * @param devices Device list.
	 * @returns Root device or null if an empty list.
	 */
	protected _findRootDevice(devices: Readonly<Readonly<IMounterDevice>[]>) {
		let r: IMounterDevice | null = null;
		for (const device of devices) {
			if (r === null || r.devEntry.length > device.devEntry.length) {
				r = device;
			}
		}
		return r;
	}

	/**
	 * Create ejects callback from a list of devices.
	 *
	 * @param devices Device list.
	 * @param ejectOnExit Eject on exit options, or null.
	 * @returns Callback function.
	 */
	protected _createEjects(
		devices: Readonly<Readonly<IMounterDevice>[]>,
		ejectOnExit = null
	) {
		// Find the root device, to use to eject (none possible in theory).
		let devEntry = this._findRootDevice(devices)?.devEntry;

		let shutdown: (() => void) | null = null;
		const info = {
			/**
			 * The eject callback function.
			 *
			 * @param options Eject options.
			 */
			eject: async (options: IMounterEjectOptions | null = null) => {
				if (devEntry) {
					await this.eject(devEntry, options);
					devEntry = '';
					if (shutdown) {
						process.off('exit', shutdown);
					}
				}
			},

			/**
			 * The eject callback function.
			 *
			 * @param options Eject options.
			 */
			ejectSync: (options: IMounterEjectOptions | null = null) => {
				if (devEntry) {
					// eslint-disable-next-line no-sync
					this.ejectSync(devEntry, options);
					devEntry = '';
					if (shutdown) {
						process.off('exit', shutdown);
					}
				}
			}
		};

		if (ejectOnExit) {
			/**
			 * Attempt to auto-eject on normal shutdown.
			 * Does not catch signals (no clean way in a library).
			 * Users can explicitly call process.exit() on signals to use this.
			 */
			shutdown = () => {
				// eslint-disable-next-line no-sync
				info.ejectSync(ejectOnExit);
			};
			process.once('exit', shutdown);
		}

		return info;
	}
}
