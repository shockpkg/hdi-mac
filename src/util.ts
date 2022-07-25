import {
	spawn as childProcessSpawn,
	SpawnOptions,
	SpawnOptionsWithoutStdio
} from 'child_process';

import {asyncExitHook} from './untyped';

/**
 * Spawn a subprocess with a promise for completion.
 *
 * @param command Command path.
 * @param args Argument list.
 * @param options Options object.
 * @returns Info object.
 */
export function spawn(
	command: string,
	args: Readonly<string[]> | null = null,
	options: Readonly<SpawnOptions | SpawnOptionsWithoutStdio> | null = null
) {
	const proc = childProcessSpawn(command, args || [], options || {});
	const done = new Promise<number | null>((resolve, reject) => {
		proc.on('exit', resolve);
		proc.on('error', reject);
	});
	return {
		proc,
		done
	};
}

const exitHooks = new Set<() => Promise<any>>();

/**
 * Exit handler.
 */
const exitHandler = async () => {
	if (!exitHooks.size) {
		return;
	}
	const list = [...exitHooks];
	exitHooks.clear();
	await Promise.all(list.map(async f => f()));
};

let exitHooked = false;

/**
 * Shutdown hook callback function.
 *
 * @param callback Callback function.
 */
export function shutdownHook(callback: () => Promise<any>) {
	if (!exitHooked) {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-call
		asyncExitHook((cb: any) => {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
			exitHandler().then(cb, cb);
		});
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
		asyncExitHook.uncaughtExceptionHandler((e: () => unknown, cb: any) => {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
			exitHandler().then(cb, cb);
		});
		exitHooked = true;
	}
	exitHooks.add(callback);
}

/**
 * Shutdown unhook callback function.
 *
 * @param callback Callback function.
 */
export function shutdownUnhook(callback: () => Promise<any>) {
	exitHooks.delete(callback);
}
