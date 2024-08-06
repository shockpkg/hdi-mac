/* eslint-disable max-nested-callbacks */
import {describe, it} from 'node:test';
import {deepStrictEqual, ok, strictEqual} from 'node:assert';
import {lstat, readdir} from 'node:fs/promises';
import {platform, release} from 'node:os';

import {Mounter} from './mounter';

const fixtures = './spec/fixtures';

const darwin = platform() === 'darwin';
const testIso = darwin;
const testHfsp = darwin;
// Darwin 18+ = macOS 10.14+ (Mojave).
const testApfs = darwin && +release().split('.')[0] >= 18;

const fixtureTestDiskImages = [
	testIso ? 'test-disk-image-hybrid.iso' : '',
	testHfsp ? 'test-disk-image-hfsp.dmg' : '',
	testHfsp ? 'test-disk-image-hfsp-j.dmg' : '',
	testHfsp ? 'test-disk-image-hfsp-c.dmg' : '',
	testHfsp ? 'test-disk-image-hfsp-j-c.dmg' : '',
	testApfs ? 'test-disk-image-apfs.dmg' : '',
	testApfs ? 'test-disk-image-apfs-c.dmg' : ''
]
	.filter(s => s.length)
	.map(s => `${fixtures}/${s}`);

async function dirlist(path: string) {
	return (await readdir(path)).filter(s => !s.startsWith('.')).sort();
}

class MounterTestRun extends Mounter {
	public attachArgs: readonly string[] = [];

	public ejectArgs: readonly string[] = [];

	protected async _runAttach(args: readonly string[]) {
		// eslint-disable-next-line no-sync
		return this._runAttachSync(args);
	}

	protected _runAttachSync(args: readonly string[]) {
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

	protected async _runEject(args: readonly string[]) {
		// eslint-disable-next-line no-sync
		this._runEjectSync(args);
	}

	protected _runEjectSync(args: readonly string[]): void {
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

		void describe('attach (fake)', () => {
			for (const fakeTestDiskImage of [
				'/tmp/fake.iso',
				'/tmp/fake.dmg'
			]) {
				void describe(fakeTestDiskImage, () => {
					void it('no options', async () => {
						const mounter = new MounterTestRun();
						await mounter.attach(fakeTestDiskImage);

						ok(!mounter.attachArgs.includes('-readonly'));
						ok(!mounter.attachArgs.includes('-nobrowse'));
					});

					void it('option: readonly = true', async () => {
						const mounter = new MounterTestRun();
						await mounter.attach(fakeTestDiskImage, {
							readonly: true
						});

						ok(mounter.attachArgs.includes('-readonly'));
					});

					void it('option: readonly = false', async () => {
						const mounter = new MounterTestRun();
						await mounter.attach(fakeTestDiskImage, {
							readonly: false
						});

						ok(!mounter.attachArgs.includes('-readonly'));
					});

					void it('option: nobrowse = true', async () => {
						const mounter = new MounterTestRun();
						await mounter.attach(fakeTestDiskImage, {
							nobrowse: true
						});

						ok(mounter.attachArgs.includes('-nobrowse'));
					});

					void it('option: nobrowse = false', async () => {
						const mounter = new MounterTestRun();
						await mounter.attach(fakeTestDiskImage, {
							nobrowse: false
						});

						ok(!mounter.attachArgs.includes('-nobrowse'));
					});

					void it('eject: no options', async () => {
						const mounter = new MounterTestRun();
						const info = await mounter.attach(fakeTestDiskImage);

						await info.eject();
						ok(mounter.ejectArgs.includes('/dev/disk42'));
					});

					void it('eject: force = false', async () => {
						const mounter = new MounterTestRun();
						const info = await mounter.attach(fakeTestDiskImage);

						await info.eject({
							force: false
						});
						ok(!mounter.ejectArgs.includes('-force'));
					});

					void it('eject: force = true', async () => {
						const mounter = new MounterTestRun();
						const info = await mounter.attach(fakeTestDiskImage);

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
				});
			}
		});

		void describe('attach (real)', () => {
			for (const fixtureTestDiskImage of fixtureTestDiskImages) {
				void describe(fixtureTestDiskImage, () => {
					for (const sync of [false, true]) {
						const desc = sync ? 'sync' : 'async';
						void it(`hdi attach and eject (${desc})`, async () => {
							const mounter = new Mounter();
							const info = sync
								? // eslint-disable-next-line no-sync
									mounter.attachSync(fixtureTestDiskImage)
								: await mounter.attach(fixtureTestDiskImage);

							let mountPoint: string | null = null;
							for (const device of info.devices) {
								if (device.mountPoint) {
									mountPoint = device.mountPoint || null;
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

							if (sync) {
								// eslint-disable-next-line no-sync
								info.ejectSync();
							} else {
								await info.eject();
							}

							if (mountPoint) {
								const st = await lstat(mountPoint).catch(
									() => null
								);
								strictEqual(st, null);
							}
						});
					}
				});
			}
		});
	});
});
