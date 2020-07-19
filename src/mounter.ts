import plist from 'plist';

import {
	shutdownHook,
	shutdownUnhook,
	spawn
} from './util';

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
}

/**
 * Mounter constructor.
 *
 * @param options Options object.
 */
export class Mounter extends Object {
	/**
	 * The path to hdiutil.
	 */
	public hdiutil: string;

	constructor(options: Readonly<IMounterOptions> | null = null) {
		super();

		this.hdiutil = (options ? options.hdiutil : null) || 'hdiutil';
	}

	/**
	 * Attach a disk image.
	 * Optionally can attempt to eject on shutdown if not ejected by callback.
	 * Passing a non-null object for ejectOnShutdown will enable auto-eject.
	 * Passing null will not enable the auto-eject on shutdown (default).
	 *
	 * @param file Path to disk image.
	 * @param options Options object.
	 * @param ejectOnShutdown Eject on shutdown options, or null.
	 * @returns Info object.
	 */
	public async attach(
		file: string,
		options: Readonly<IMounterAttachOptions> | null = null,
		ejectOnShutdown: Readonly<IMounterEjectOptions> | null = null
	) {
		// Assemble args.
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

		// Run command.
		const devices = await this._runAttach(args);

		// Create the eject callback.
		const eject = this._createEject(devices, ejectOnShutdown);

		const info: IMounterAttachInfo = {
			devices,
			eject
		};
		return info;
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
		// Assemble args.
		const args = ['eject'];
		if (options && options.force) {
			args.push('-force');
		}
		args.push(this._fileArg(file));

		// Run command.
		await this._runEject(args);
	}

	/**
	 * Run hdiutil attach command, returning the devices list on success.
	 *
	 * @param args CLI args.
	 * @returns Devices list.
	 */
	protected async _runAttach(args: Readonly<string[]>) {
		const {proc, done} = spawn(this.hdiutil, args);
		const stdoutData: Buffer[] = [];
		if (proc.stdout) {
			proc.stdout.on('data', data => {
				stdoutData.push(data);
			});
		}

		const code = await done;
		if (code) {
			throw new Error(`Attach failed: hdiutil exit code: ${code}`);
		}
		const stdout = Buffer.concat(stdoutData).toString();

		return this._parseDevices(stdout);
	}

	/**
	 * Run hdiutil eject command.
	 *
	 * @param args CLI args.
	 */
	protected async _runEject(args: Readonly<string[]>) {
		const {done} = spawn(this.hdiutil, args);

		const code = await done;
		if (code) {
			throw new Error(`Eject failed: hdiutil exit code: ${code}`);
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
		// eslint-disable-next-line @typescript-eslint/prefer-string-starts-ends-with
		return file.charAt(0) === '-' ? `./${file}` : file;
	}

	/**
	 * Parse devices plist into devices list.
	 *
	 * @param xml XML plist.
	 * @returns Devices list.
	 */
	protected _parseDevices(xml: string) {
		const parsed = plist.parse(xml);

		const errMsg = (s: string) => `Error parsing hdiutil plist: ${s}`;
		if (!parsed) {
			throw new Error(errMsg('root'));
		}

		const systemEntities = (parsed as any)['system-entities'];
		if (!Array.isArray(systemEntities)) {
			throw new Error(errMsg('system-entities'));
		}

		const entityProp = (entity: any, prop: string, type: string) => {
			const r = entity[prop];
			if (typeof r !== type) {
				throw new Error(errMsg(`system-entities > * > ${prop}`));
			}
			return r;
		};

		const entityPropNull = (entity: any, prop: string, type: string) => {
			if (prop in entity) {
				return entityProp(entity, prop, type);
			}
			return null;
		};

		const r: IMounterDevice[] = [];
		for (const entity of systemEntities) {
			if (!entity || typeof entity !== 'object') {
				throw new Error(errMsg('system-entities > *'));
			}

			const devEntry = entityProp(
				entity, 'dev-entry', 'string'
			) as string;

			const potentiallyMountable = entityProp(
				entity, 'potentially-mountable', 'boolean'
			) as boolean;

			const contentHint = entityPropNull(
				entity, 'content-hint', 'string'
			) as string | null;

			const unmappedContentHint = entityPropNull(
				entity, 'unmapped-content-hint', 'string'
			) as string | null;

			const volumeKind = entityPropNull(
				entity, 'volume-kind', 'string'
			) as string | null;

			const mountPoint = entityPropNull(
				entity, 'mount-point', 'string'
			) as string | null;

			const device: IMounterDevice = {
				devEntry,
				potentiallyMountable
			};
			if (contentHint !== null) {
				device.contentHint = contentHint;
			}
			if (unmappedContentHint !== null) {
				device.unmappedContentHint = unmappedContentHint;
			}
			if (volumeKind !== null) {
				device.volumeKind = volumeKind;
			}
			if (mountPoint !== null) {
				device.mountPoint = mountPoint;
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
	 * Create an eject callback from list of devices.
	 *
	 * @param devices Device list.
	 * @param ejectOnShutdown Eject on shutdown options.
	 * @returns Callback function.
	 */
	protected _createEject(
		devices: Readonly<Readonly<IMounterDevice>[]>,
		ejectOnShutdown: Readonly<IMounterEjectOptions> | null = null
	) {
		// Find the root device, to use to eject (none possible in theory).
		const rootDev = this._findRootDevice(devices);
		const rootDevPath = rootDev ? rootDev.devEntry : null;

		let shutdownEjector: any = null;

		// The eject callback function.
		const eject = async (options: IMounterEjectOptions | null = null) => {
			// If shutdown ejector registered, remove now.
			if (shutdownEjector) {
				shutdownUnhook(shutdownEjector);
				shutdownEjector = null;
			}

			// Only eject if something to eject.
			if (!rootDevPath) {
				return;
			}
			await this.eject(rootDevPath, options);
		};

		// Possibly register shutdown hook, using the eject options.
		if (rootDevPath && ejectOnShutdown) {
			shutdownEjector = async () => {
				await eject(ejectOnShutdown);
			};
			shutdownHook(shutdownEjector);
		}

		return eject;
	}
}
