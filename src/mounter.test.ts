/* eslint-disable max-nested-callbacks */
import {describe, it} from 'node:test';
import {deepStrictEqual, ok, strictEqual} from 'node:assert';
import {lstat, readdir} from 'fs';
import {promisify} from 'util';

import {Mounter} from './mounter';

const readdirP = promisify(readdir);
const lstatP = promisify(lstat);

const fixtures = './spec/fixtures';

// eslint-disable-next-line no-process-env
const testApfs = process.env.HDI_MAC_DISABLE_TEST_APFS !== '1';

const fixtureTestDiskImages = [
	'test-disk-image-hybrid.iso',
	'test-disk-image-hfsp.dmg',
	'test-disk-image-hfsp-j.dmg',
	'test-disk-image-hfsp-c.dmg',
	'test-disk-image-hfsp-j-c.dmg',
	testApfs ? 'test-disk-image-apfs.dmg' : '',
	testApfs ? 'test-disk-image-apfs-c.dmg' : ''
]
	.filter(s => s.length)
	.map(s => `${fixtures}/${s}`);

async function dirlist(path: string, dotfiles = true) {
	const r = await readdirP(path);
	// eslint-disable-next-line @typescript-eslint/prefer-string-starts-ends-with
	return r.filter(s => (s.charAt(0) === '.' ? dotfiles : true)).sort();
}

async function stat(path: string) {
	try {
		return await lstatP(path);
	} catch (err) {
		return null;
	}
}

class MounterTestRun extends Mounter {
	public attachArgs: Readonly<string[]> = [];

	public ejectArgs: Readonly<string[]> = [];

	// eslint-disable-next-line @typescript-eslint/require-await
	protected async _runAttach(args: Readonly<string[]>) {
		this.attachArgs = args;
		return [
			{
				contentHint: 'GUID_partition_scheme',
				unmappedContentHint: 'GUID_partition_scheme',
				devEntry: '/dev/disk42',
				potentiallyMountable: false
			},
			{
				contentHint: 'Apple_HFS',
				unmappedContentHint: '00000000-0000-0000-0000-000000000000',
				devEntry: '/dev/disk42s1',
				potentiallyMountable: true,
				volumeKind: 'hfs',
				mountPoint: '/Volumes/test-disk-image'
			}
		];
	}

	// eslint-disable-next-line @typescript-eslint/require-await
	protected async _runEject(args: Readonly<string[]>) {
		this.ejectArgs = args;
	}
}

void describe('mounter', () => {
	void describe('Mounter', () => {
		void describe('constructor', () => {
			void it('no options', () => {
				const mounter = new Mounter();

				strictEqual(mounter.hdiutil, 'hdiutil');
			});

			void it('option: hdiutil', () => {
				const dummy = '/tmp/dummy';
				const mounter = new Mounter({
					hdiutil: dummy
				});

				strictEqual(mounter.hdiutil, dummy);
			});
		});

		void describe('attach', () => {
			for (const fixtureTestDiskImage of fixtureTestDiskImages) {
				// eslint-disable-next-line no-loop-func
				void describe(fixtureTestDiskImage, () => {
					void it('no options', async () => {
						const mounter = new MounterTestRun();
						await mounter.attach(fixtureTestDiskImage);

						ok(!mounter.attachArgs.includes('-readonly'));
						ok(!mounter.attachArgs.includes('-nobrowse'));
					});

					void it('option: readonly = true', async () => {
						const mounter = new MounterTestRun();
						await mounter.attach(fixtureTestDiskImage, {
							readonly: true
						});

						ok(mounter.attachArgs.includes('-readonly'));
					});

					void it('option: readonly = false', async () => {
						const mounter = new MounterTestRun();
						await mounter.attach(fixtureTestDiskImage, {
							readonly: false
						});

						ok(!mounter.attachArgs.includes('-readonly'));
					});

					void it('option: nobrowse = true', async () => {
						const mounter = new MounterTestRun();
						await mounter.attach(fixtureTestDiskImage, {
							nobrowse: true
						});

						ok(mounter.attachArgs.includes('-nobrowse'));
					});

					void it('option: nobrowse = false', async () => {
						const mounter = new MounterTestRun();
						await mounter.attach(fixtureTestDiskImage, {
							nobrowse: false
						});

						ok(!mounter.attachArgs.includes('-nobrowse'));
					});

					void it('eject: no options', async () => {
						const mounter = new MounterTestRun();
						const info = await mounter.attach(fixtureTestDiskImage);

						await info.eject();
						ok(mounter.ejectArgs.includes('/dev/disk42'));
					});

					void it('eject: force = false', async () => {
						const mounter = new MounterTestRun();
						const info = await mounter.attach(fixtureTestDiskImage);

						await info.eject({
							force: false
						});
						ok(!mounter.ejectArgs.includes('-force'));
					});

					void it('eject: force = true', async () => {
						const mounter = new MounterTestRun();
						const info = await mounter.attach(fixtureTestDiskImage);

						await info.eject({
							force: true
						});
						ok(mounter.ejectArgs.includes('-force'));
					});

					void it('file not an argument', async () => {
						const dummy = '-test.dmg';
						const mounter = new MounterTestRun();
						await mounter.attach(dummy);

						ok(!mounter.attachArgs.includes(dummy));
						ok(mounter.attachArgs.includes(`./${dummy}`));
					});

					void it('hdi attach and eject', async () => {
						const mounter = new Mounter();
						const info = await mounter.attach(
							fixtureTestDiskImage,
							null,
							{}
						);

						let mountPoint: string | null = null;
						for (const device of info.devices) {
							if (device.mountPoint) {
								// eslint-disable-next-line prefer-destructuring
								mountPoint = device.mountPoint;
							}
						}
						strictEqual(typeof mountPoint, 'string');
						if (mountPoint) {
							const listing = await dirlist(mountPoint);
							deepStrictEqual(listing, [
								'file-a.txt',
								'file-b.txt',
								'file-c.txt'
							]);
						}

						await info.eject();

						if (mountPoint) {
							const st = await stat(mountPoint);
							strictEqual(st, null);
						}
					});
				});
			}
		});
	});
});
