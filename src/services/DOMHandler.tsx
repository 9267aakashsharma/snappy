import React, { useCallback, useEffect, useState } from "react";
import ReactDOM from "react-dom/client";

import {
  Message,
  MessageResponse,
  MessageResponseTypes,
  MessageTypes,
  StartRecordingProps,
} from "../types";
import { useMediaStream, useRecorder } from "../hooks";
import { UserMedia } from "../components";
import styled from "styled-components";

// NOTE - This is a variable listener, it will provide a listener that will run whenever that variable changes
let showPopupDiv = {
  showInternal: false,
  showListener: function (val: boolean) {},
  set show(val) {
    this.showInternal = val;
    this.showListener(val);
  },
  get show() {
    return this.showInternal;
  },
  registerListener: function (listener: any) {
    this.showListener = listener;
  },
};

const DOMHandler = () => {
  const [error, setError] = useState<string>();
  const [showPopup, setShowPopup] = useState(showPopupDiv.show);

  const { start, stop, state, getBlobs } = useRecorder();
  const { stream, startStream, stopStream } = useMediaStream();

  const handleRecording = useCallback(
    async (payload: StartRecordingProps): Promise<MessageResponse> => {
      try {
        const { streamId } = payload;

        if (!streamId || !streamId.length) {
          showPopupDiv.show = true;
          setError("Stream Id is required to start the recording");
          return {
            success: false,
            type: MessageResponseTypes.error,
            message: "Stream Id is required to start the recording",
          };
        }

        const screenStream = await navigator.mediaDevices.getUserMedia({
          video: {
            // @ts-ignore
            mandatory: {
              chromeMediaSource: "desktop",
              chromeMediaSourceId: streamId,
            },
          },
        });

        if (!screenStream)
          throw new Error("Could not get the screen stream from the stream id");

        start({ stream: screenStream, localStream: stream });

        return {
          success: true,
          message: "Recording started",
          type: MessageResponseTypes.success,
        };
      } catch (error: any) {
        return {
          success: false,
          type: MessageResponseTypes.error,
          message: error.message || "Failed to record",
        };
      }
    },
    [start, stream]
  );

  const handleRecord = () => {
    showPopupDiv.show = false;
    const message: Message = {
      type: MessageTypes.getStream,
    };

    chrome.runtime.sendMessage(message, (response: MessageResponse) => {
      if (!response.success) {
        showPopupDiv.show = true;
        return;
      }
    });
  };

  const messageHandler = useCallback(
    async (message: Message): Promise<MessageResponse> => {
      if (message.type === MessageTypes.startRecording) {
        if (!message.payload)
          return {
            success: false,
            type: MessageResponseTypes.error,
            message: "Could not find the payload stream",
          };
        return await handleRecording(message.payload);
      } else if (message.type === MessageTypes.iconClicked) {
        if (state === "recording") {
          stop();
          stopStream();
        } else {
          showPopupDiv.show = true;
          await startStream();
        }
        return {
          success: true,
          message: "Popup shown",
          type: MessageResponseTypes.success,
        };
      }
      return {
        success: false,
        type: MessageResponseTypes.error,
        message: "Unknown message type",
      };
    },
    [state, startStream, stop, stopStream, handleRecording]
  );

  useEffect(() => {
    (async () => {
      if (state === "recording") {
        showPopupDiv.show = false;
        await chrome.runtime.sendMessage({
          type: MessageTypes.setBadge,
          payload: {
            text: {
              text: "Rec",
            },
            color: {
              color: [252, 16, 16, 1],
            },
          },
        } as Message);
      } else {
        await chrome.runtime.sendMessage({
          type: MessageTypes.setBadge,
          payload: {
            text: {
              text: "",
            },
            color: {
              color: [0, 0, 0, 0],
            },
          },
        } as Message);
      }

      if (state === "stop") {
        const blob = await getBlobs();
        console.log("blob", blob);
        if (!blob) return;

        showPopupDiv.show = true;

        const message: Message = {
          type: MessageTypes.redirect,
          payload: {
            url: URL.createObjectURL(blob),
          },
        };
        await chrome.runtime.sendMessage(message);
      }
    })();
  }, [state, getBlobs]);

  useEffect(() => {
    showPopupDiv.registerListener(function (show: boolean) {
      setShowPopup(show);
    });
    chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
      messageHandler(request)
        .then((response) => {
          sendResponse(response);
        })
        .catch((error) => {
          console.error(error);

          sendResponse({
            success: false,
            type: MessageResponseTypes.error,
            message: error?.message || "Error at Message Listener",
          } as MessageResponse);
        });

      return true; // NOTE - This is done because the response might be asynchronous
    });
  }, [messageHandler]);

  return (
    <>
      {(showPopDiv || state === "recording") && <UserMedia stream={stream} />}
      {showPopup && (
        <Popup>
          <TextBtn onClick={handleRecord}>
            {state === "recording" ? "Stop Recording" : "Start Recording"}
          </TextBtn>
          <CircleFilled />
          <CircleOutline onClick={handleRecord} />
          {error && <p>{error}</p>}
        </Popup>
      )}
    </>
  );
};

const showPopDiv = () => {
  // check if already injected, otherwise
  const isDivAlreadyInjected = document.getElementById("snappy-root");
  if (isDivAlreadyInjected) {
    isDivAlreadyInjected.remove();
    console.log("removed successfully");
  }

  const extensionApp = document.createElement("div") as HTMLElement;
  extensionApp.id = "snappy-root";

  document.body.insertAdjacentElement("afterend", extensionApp);
  document.body.onclick = () => {
    if (document.body.nextSibling === extensionApp) {
      showPopupDiv.show = false;
    }
  };

  const extensionRoot = ReactDOM.createRoot(extensionApp);

  extensionRoot.render(
    <React.StrictMode>
      <DOMHandler />
    </React.StrictMode>
  );
};

showPopDiv();

const Popup = styled.div`
  width: 320px;
  min-height: 400px;
  pointer-events: all;
  position: fixed;
  top: 1rem;
  right: 1rem;
  display: flex;
  flex-direction: column;
  border-radius: 0.375rem;
  color: rgb(243, 244, 246);
  background-color: #222;
  box-shadow: rgba(0, 0, 0, 0.35) 0px 5px 15px;
`;

const CircleOutline = styled.div`
  position: absolute;
  margin: auto;
  top: 33%;
  left: 33%;
  background-color: transparent;
  border: 4px solid #fff;
  border-radius: 50%;
  height: 100px;
  width: 100px;
  cursor: pointer;
`;

const CircleFilled = styled.div`
  position: absolute;
  margin: auto;
  top: 33%;
  left: 33%;
  margin-top: 10px;
  margin-left: 10px;
  background-color: red;
  border-radius: 50%;
  height: 80px;
  width: 80px;
`;

const TextBtn = styled.button`
  background-color: transparent;
  border: none;
  color: #fff;
  font-size: 1.5rem;
  font-weight: 600;
  cursor: pointer;
  outline: none;
  margin-top: 80%;
  &:hover {
    color: #ccc;
  }
`;
