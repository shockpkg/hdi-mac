import {
	spawn as childProcessSpawn,
	SpawnOptions,
	SpawnOptionsWithoutStdio
} from 'child_process';

/**
 * Spawn a subprocess with a promise for completion.
 *
 * @param command Command path.
 * @param args Argument list.
 * @param options Options object.
 * @return Info object.
 */
export function spawn(
	command: string,
	args: string[] | null = null,
	options: SpawnOptions | SpawnOptionsWithoutStdio | null = null
) {
	const proc = childProcessSpawn(command, args || [], options || {});
	const done = new Promise<number | null>((resolve, reject) => {
		proc.on('exit', code => {
			resolve(code);
		});
		proc.on('error', err => {
			reject(err);
		});
	});
	return {
		proc,
		done
	};
}
