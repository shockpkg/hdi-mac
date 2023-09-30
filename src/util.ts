import asyncExitHook from 'async-exit-hook';

const exitHooks = new Set<() => Promise<unknown>>();

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
export function shutdownHook(callback: () => Promise<unknown>) {
	if (!exitHooked) {
		asyncExitHook(done => {
			exitHandler().then(done, done);
		});
		asyncExitHook.uncaughtExceptionHandler((_error, done) => {
			exitHandler().then(done, done);
		});
		asyncExitHook.unhandledRejectionHandler((_error, done) => {
			exitHandler().then(done, done);
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
export function shutdownUnhook(callback: () => Promise<unknown>) {
	exitHooks.delete(callback);
}
