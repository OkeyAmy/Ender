// Prevent Console Ninja (VS Code extension) from injecting its websocket logger,
// which was spamming the terminal and slowing boot.
declare global {
  // Console Ninja flags
  // eslint-disable-next-line no-var
  var _consoleNinjaAllowedToStart: boolean | undefined;
  // eslint-disable-next-line no-var
  var _triedToInstallGlobalErrorHandler: boolean | undefined;
  // eslint-disable-next-line no-var
  var _triedToInstallNetworkLoggingHandler: boolean | undefined;
}

export async function register() {
  const g = globalThis as typeof globalThis & {
    _consoleNinjaAllowedToStart?: boolean;
    _triedToInstallGlobalErrorHandler?: boolean;
    _triedToInstallNetworkLoggingHandler?: boolean;
  };

  // Explicitly tell Console Ninja not to start in server/runtime contexts.
  g._consoleNinjaAllowedToStart = false;
  g._triedToInstallGlobalErrorHandler = true;
  g._triedToInstallNetworkLoggingHandler = true;
}
