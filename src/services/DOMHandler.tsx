import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";

import {
  Message,
  MessageResponse,
  MessageResponseTypes,
  MessageTypes,
  StartRecordingProps,
} from "../types";
import { useRecorder } from "../hooks";
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
  const [userStream, setUserStream] = useState<MediaStream | null>(null);
  const [showPopup, setShowPopup] = useState(showPopupDiv.show);

  const { start, stop, state, getBlobs } = useRecorder();

  const getUserMediaStream = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: {
        facingMode: "user",
        width: { min: 1024, ideal: 1280, max: 1920 },
        height: { min: 576, ideal: 720, max: 1080 },
      },
    });
    return stream;
  };

  const handleRecording = async (
    payload: StartRecordingProps
  ): Promise<MessageResponse> => {
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

      console.log("stream-in-recording", userStream);
      const audioStream = userStream
        ? new MediaStream([...userStream.getAudioTracks()])
        : undefined;
      start({ stream: screenStream, localStream: audioStream });

      return {
        success: true,
        message: "Recording started",
        type: MessageResponseTypes.success,
      };
    } catch (error: any) {
      setError(error.message || "Failed to record");
      return {
        success: false,
        type: MessageResponseTypes.error,
        message: error.message || "Failed to record",
      };
    }
  };

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

  const messageHandler = async (message: Message): Promise<MessageResponse> => {
    if (message.type === MessageTypes.startRecording) {
      if (!message.payload)
        return {
          success: false,
          type: MessageResponseTypes.error,
          message: "Could not find the payload stream",
        };
      console.log("stream-in-messageHandler", userStream);
      return await handleRecording(message.payload);
    } else if (message.type === MessageTypes.iconClicked) {
      if (state === "recording") {
        stop();
      } else {
        showPopupDiv.show = true;
        const stream = await getUserMediaStream();
        setUserStream(stream);
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
  };

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
  }, []);

  useEffect(() => {
    console.log("stream", userStream);
  }, [userStream]);

  useEffect(() => {
    console.log("state", state);
  }, [state]);

  return (
    <>
      {(showPopDiv || state === "recording") && (
        <UserMedia stream={userStream} />
      )}
      {showPopup && (
        <Popup>
          <button onClick={handleRecord}>
            {state === "recording" ? "Stop Recording" : "Start Recording"}
          </button>
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
  background-color: rgb(55, 65, 81);
  box-shadow: rgba(0, 0, 0, 0.35) 0px 5px 15px;
`;
