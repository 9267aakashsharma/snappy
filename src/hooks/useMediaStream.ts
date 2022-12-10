import { useEffect, useState } from "react";

const defaultConstraints = {
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
};

export type StreamState = "inactive" | "active";

const useMediaStream = (constraint = defaultConstraints) => {
  const [state, setState] = useState<StreamState>("inactive");
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      mediaStream?.getTracks().forEach((track) => track.stop());
      setState("inactive");
    };
  }, [mediaStream]);

  const startStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraint);
      setMediaStream(stream);
      setState("active");
    } catch (error) {
      console.error(error);
    }
  };

  const stopStream = () => {
    mediaStream?.getTracks().forEach((track) => track.stop());
    setState("inactive");
  };

  return {
    state,
    stopStream,
    startStream,
    stream: mediaStream,
  };
};

export default useMediaStream;
