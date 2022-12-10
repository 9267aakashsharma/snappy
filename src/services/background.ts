import {
  Message,
  MessageResponse,
  MessageResponseTypes,
  MessageTypes,
  RedirectProps,
  SetBadgeProps,
} from "../types";

// NOTE - This function calls the chrome API to request for the screen capture and send the stream id to the content script.
const handleStartRecording = (): Promise<MessageResponse> => {
  return new Promise(async (resolve, reject) => {
    chrome.tabs &&
      chrome.tabs.query(
        {
          active: true,
          currentWindow: true,
        },
        (tabs) => {
          tabs[0] &&
            chrome.desktopCapture.chooseDesktopMedia(
              ["screen", "window", "tab"],
              tabs[0],
              async (streamId: string, options: any) => {
                console.log("streamId", streamId);
                if (!streamId || streamId.length < 1)
                  reject({
                    success: false,
                    message: "No stream id",
                    type: MessageResponseTypes.error,
                  } as MessageResponse);

                const message: Message = {
                  type: MessageTypes.startRecording,
                  payload: {
                    options,
                    streamId,
                  },
                };

                chrome.tabs.sendMessage(
                  tabs[0].id || 0,
                  message,
                  (response: MessageResponse) => {
                    if (response?.success) {
                      resolve(response);
                    } else {
                      reject(response);
                    }
                  }
                );
              }
            );
        }
      );
  });
};

// NOTE - This function creates aa new tab and redirects to that url.
const handleRedirect = async (payload: RedirectProps) => {
  await chrome.tabs.create({
    url: payload.url,
  });
  return {
    success: true,
    message: "Redirected",
    type: MessageResponseTypes.success,
  } as MessageResponse;
};

// NOTE - This function sets the Badge on the extension icon.
const handleBadge = async (payload: SetBadgeProps) => {
  try {
    await chrome.action.setBadgeText({
      text: payload.text.text,
    });
    await chrome.action.setBadgeBackgroundColor({
      color: payload.color.color,
    });
  } catch (error) {
    console.error(JSON.stringify(error));
  }

  return {
    success: true,
    message: "Badge set",
    type: MessageResponseTypes.success,
  } as MessageResponse;
};

// NOTE - This function manages each message request and call their respective functions.
const messageHandler = async (message: Message): Promise<MessageResponse> => {
  try {
    switch (message.type) {
      case MessageTypes.getStream:
        return await handleStartRecording();

      case MessageTypes.redirect:
        return await handleRedirect(message.payload);

      case MessageTypes.setBadge:
        return await handleBadge(message.payload);

      default:
        return {
          success: false,
          message: "Unknown message type",
          type: MessageResponseTypes.error,
        };
    }
  } catch (error: any) {
    console.error(JSON.stringify(error));

    return {
      success: false,
      type: MessageResponseTypes.error,
      message: error?.message || "Unknown message type",
    };
  }
};

// NOTE - This function will listen for messages from the content script.
const messagesFromReactAppListener = (
  message: Message,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: any) => void
) => {
  messageHandler(message)
    .then((response: MessageResponse) => {
      sendResponse(response);
    })
    .catch((error) => {
      console.error(JSON.stringify(error));
      sendResponse({
        success: false,
        payload: error,
        type: MessageResponseTypes.error,
        message: error?.message || "Unknown message type",
      } as MessageResponse);
    });

  return true; // NOTE - This is done because the response might be asynchronous
};

/**
 * NOTE - Fired when a message is sent from either an extension process or a content script.
 */
chrome.runtime.onMessage.addListener(messagesFromReactAppListener);

/**
 * NOTE - Fired when extension icon is clicked.
 */
chrome.action.onClicked.addListener(async (tab) => {
  console.log("Snappy extension - Successfully installed in: ", tab.url);
  try {
    tab.id &&
      chrome.tabs.sendMessage(tab.id, {
        type: MessageTypes.iconClicked,
      } as Message);
  } catch (error) {
    console.error(JSON.stringify(error));
  }
});

/**
 * NOTE - Masking receiving end does not exist error.
 */
chrome.runtime.onConnect.addListener(() => {});

/**
 *
 * @param scripts - Array of scripts to be injected into the page.
 * @param tabId - Id of the tab to inject the scripts into.
 */
const injectScriptsToTabId = async (
  scripts: chrome.runtime.ManifestBase["content_scripts"],
  tabId: number
) => {
  scripts?.forEach(async (script) => {
    if (!script.js) return;
    chrome.scripting.executeScript(
      {
        target: { tabId, allFrames: true },
        files: script.js,
      },
      () => void chrome.runtime.lastError
    );
    chrome.scripting.insertCSS(
      {
        target: { tabId },
        files: script.css,
      },
      () => void chrome.runtime.lastError
    );
  });
};

/**
 * NOTE - Fired when extension is installed. This will store content script to all older pages.
 */
chrome.runtime.onInstalled.addListener(async () => {
  const scripts = chrome.runtime.getManifest().content_scripts;
  scripts &&
    chrome.windows.getAll((windows) => {
      console.log(scripts, windows);
      if (!windows) return;

      windows?.forEach((window) => {
        chrome.tabs.query(
          {
            windowId: window.id,
          },
          (tabs) => {
            console.log("window tabs", tabs);
            tabs.forEach((tab) => {
              tab.id && injectScriptsToTabId(scripts, tab.id);
            });
          }
        );
      });
    });
});

export {};
