import {
	parse as plistParse
} from 'plist';

import {property} from './decorators';
import {spawn} from './util';

export interface IMounterOptions {
	/**
	 * The path for hdiutil.
	 *
	 * @defailt 'hdiutil'
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
	eject(options?: IMounterEjectOptions | null): Promise<void>;
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
	@property(false)
	protected readonly _hdiutil: string;

	constructor(options: IMounterOptions | null = null) {
		super();

		this._hdiutil = (options ? options.hdiutil : null) || 'hdiutil';
	}

	/**
	 * The path to hdiutil.
	 */
	public get hdiutil() {
		return this._hdiutil;
	}

	/**
	 * Attach a disk image.
	 *
	 * @param file Path to disk image.
	 * @param options Options object.
	 * @return Info object.
	 */
	public async attach(
		file: string,
		options: IMounterAttachOptions | null = null
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
		const eject = this._createEject(devices);

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
		options: IMounterEjectOptions | null = null
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
	 * @return Devices list.
	 */
	protected async _runAttach(args: string[]) {
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
	protected async _runEject(args: string[]) {
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
	 * @return A path for use as argument.
	 */
	protected _fileArg(file: string) {
		// Make sure it will not be recognized as option argument.
		return file.charAt(0) === '-' ? `./${file}` : file;
	}

	/**
	 * Parse devices plist into devices list.
	 *
	 * @param xml XML plist.
	 * @return Devices list.
	 */
	protected _parseDevices(xml: string) {
		const parsed = plistParse(xml);

		const errMsg = (s: string) => `Error parsing hdiutil plist: ${s}`;
		if (!parsed) {
			throw new Error(errMsg('root'));
		}

		const systemEntities = (parsed as any)['system-entities'];
		if (!Array.isArray(systemEntities)) {
			throw new Error(errMsg('system-entities'));
		}

		const entityProperty = (entity: any, prop: string, type: string) => {
			const r = entity[prop];
			if (typeof r !== type) {
				throw new Error(errMsg(`system-entities > * > ${prop}`));
			}
			return r;
		};

		const entityPropertyNull =
			(entity: any, prop: string, type: string) => {
				if (prop in entity) {
					return entityProperty(entity, prop, type);
				}
				return null;
			};

		const r: IMounterDevice[] = [];
		for (const entity of systemEntities) {
			if (!entity || typeof entity !== 'object') {
				throw new Error(errMsg('system-entities > *'));
			}

			const devEntry = entityProperty(
				entity, 'dev-entry', 'string'
			) as string;

			const potentiallyMountable = entityProperty(
				entity, 'potentially-mountable', 'boolean'
			) as boolean;

			const contentHint = entityPropertyNull(
				entity, 'content-hint', 'string'
			) as string | null;

			const unmappedContentHint = entityPropertyNull(
				entity, 'unmapped-content-hint', 'string'
			) as string | null;

			const volumeKind = entityPropertyNull(
				entity, 'volume-kind', 'string'
			) as string | null;

			const mountPoint = entityPropertyNull(
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
	 * @return Root device or null if an empty list.
	 */
	protected _findRootDevice(devices: IMounterDevice[]) {
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
	 * @return Callback function.
	 */
	protected _createEject(devices: IMounterDevice[]) {
		// Find the root device, to use to eject (none possible in theory).
		const rootDev = this._findRootDevice(devices);
		const rootDevPath = rootDev ? rootDev.devEntry : null;

		return async (options: IMounterEjectOptions | null = null) => {
			if (!rootDevPath) {
				return;
			}
			await this.eject(rootDevPath, options);
		};
	}
}
