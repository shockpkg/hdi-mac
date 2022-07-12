/* eslint-disable max-nested-callbacks */
import {lstat, readdir} from 'fs';
import {promisify} from 'util';

import {Mounter} from './mounter';

const readdirP = promisify(readdir);
const lstatP = promisify(lstat);

const mountTimeout = 1000 * 60;

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

describe('mounter', () => {
	describe('Mounter', () => {
		describe('constructor', () => {
			it('no options', () => {
				const mounter = new Mounter();

				expect(mounter.hdiutil).toBe('hdiutil');
			});

			it('option: hdiutil', () => {
				const dummy = '/tmp/dummy';
				const mounter = new Mounter({
					hdiutil: dummy
				});

				expect(mounter.hdiutil).toBe(dummy);
			});
		});

		describe('attach', () => {
			for (const fixtureTestDiskImage of fixtureTestDiskImages) {
				// eslint-disable-next-line no-loop-func
				describe(fixtureTestDiskImage, () => {
					it('no options', async () => {
						const mounter = new MounterTestRun();
						await mounter.attach(fixtureTestDiskImage);

						expect(mounter.attachArgs).not.toContain('-readonly');
						expect(mounter.attachArgs).not.toContain('-nobrowse');
					});

					it('option: readonly = true', async () => {
						const mounter = new MounterTestRun();
						await mounter.attach(fixtureTestDiskImage, {
							readonly: true
						});

						expect(mounter.attachArgs).toContain('-readonly');
					});

					it('option: readonly = false', async () => {
						const mounter = new MounterTestRun();
						await mounter.attach(fixtureTestDiskImage, {
							readonly: false
						});

						expect(mounter.attachArgs).not.toContain('-readonly');
					});

					it('option: nobrowse = true', async () => {
						const mounter = new MounterTestRun();
						await mounter.attach(fixtureTestDiskImage, {
							nobrowse: true
						});

						expect(mounter.attachArgs).toContain('-nobrowse');
					});

					it('option: nobrowse = false', async () => {
						const mounter = new MounterTestRun();
						await mounter.attach(fixtureTestDiskImage, {
							nobrowse: false
						});

						expect(mounter.attachArgs).not.toContain('-nobrowse');
					});

					it('eject: no options', async () => {
						const mounter = new MounterTestRun();
						const info = await mounter.attach(fixtureTestDiskImage);

						await info.eject();
						expect(mounter.ejectArgs).toContain('/dev/disk42');
					});

					it('eject: force = false', async () => {
						const mounter = new MounterTestRun();
						const info = await mounter.attach(fixtureTestDiskImage);

						await info.eject({
							force: false
						});
						expect(mounter.ejectArgs).not.toContain('-force');
					});

					it('eject: force = true', async () => {
						const mounter = new MounterTestRun();
						const info = await mounter.attach(fixtureTestDiskImage);

						await info.eject({
							force: true
						});
						expect(mounter.ejectArgs).toContain('-force');
					});

					it('file not an argument', async () => {
						const dummy = '-test.dmg';
						const mounter = new MounterTestRun();
						await mounter.attach(dummy);

						expect(mounter.attachArgs).not.toContain(dummy);
						expect(mounter.attachArgs).toContain(`./${dummy}`);
					});

					it(
						'hdi attach and eject',
						async () => {
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
							expect(typeof mountPoint).toBe('string');
							if (mountPoint) {
								const listing = await dirlist(mountPoint);
								expect(listing).toEqual([
									'file-a.txt',
									'file-b.txt',
									'file-c.txt'
								]);
							}

							await info.eject();

							if (mountPoint) {
								const st = await stat(mountPoint);
								expect(st).toBeNull();
							}
						},
						mountTimeout
					);
				});
			}
		});
	});
});
