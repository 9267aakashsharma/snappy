import { useRef, useState } from "react";
import { getSeekableWebM } from "../utils/helpers";

export type UseRecorderState = RecordingState | "stop";

const types = [
  "video/x-matroska;codecs=avc1",
  "video/webm;codecs=h264",
  "video/webm",
  "video/webm,codecs=vp9",
  "video/vp8",
  "video/webm;codecs=vp8",
  "video/webm;codecs=daala",
  "video/mpeg",
];

type ElementType<T extends ReadonlyArray<unknown>> = T extends ReadonlyArray<
  infer ElementType
>
  ? ElementType
  : never;

const useRecorder = (videoBitsPerSecond: number | undefined = 12000000) => {
  const [type, setType] = useState<ElementType<typeof types>>();
  const [state, setState] = useState<UseRecorderState>("inactive");

  const blobs = useRef<Blob[]>([]);
  const duration = useRef<number>(0);
  const recorder = useRef<MediaRecorder | null>(null);

  const ctx = useRef<AudioContext | null>(null);
  const dest = useRef<MediaStreamAudioDestinationNode | null>(null);

  const handleDataAvailable = (event: BlobEvent) => {
    if (event.data && event.data.size > 0) {
      blobs.current.push(event.data);
    }
  };

  const start = ({
    stream,
    localStream,
  }: {
    stream: MediaStream;
    localStream?: MediaStream;
  }) => {
    if (!stream) {
      throw Error("No stream found");
    }

    const type = types.find((type) => MediaRecorder.isTypeSupported(type));
    if (!type) throw Error("No supported type found for MediaRecorder");
    setType(type);

    if (localStream) {
      ctx.current = new AudioContext({});
      ctx.current?.createMediaStreamSource(localStream);

      const tracks = localStream.getTracks();
      const audioStream = ctx.current?.createMediaStreamSource(
        new MediaStream(tracks)
      );

      dest.current = ctx.current.createMediaStreamDestination();
      audioStream.connect(dest.current);

      ctx.current.createMediaStreamSource(localStream).connect(dest.current);

      recorder.current = new MediaRecorder(
        new MediaStream([
          ...stream.getTracks(),
          ...dest.current.stream.getTracks(),
        ]),
        {
          videoBitsPerSecond,
          mimeType: type,
        }
      );
    } else {
      recorder.current = new MediaRecorder(stream, {
        videoBitsPerSecond,
        mimeType: type,
      });
    }

    blobs.current = [];

    addListeners();
    recorder.current.start(100); // collect 100ms of data blobs
  };

  const addListeners = () => {
    recorder.current?.addEventListener("dataavailable", handleDataAvailable);

    recorder.current?.addEventListener("stop", (e) => {
      console.log("stopped");
      duration.current = Date.now() - duration.current;
      recorder.current?.stream.getTracks().forEach((track) => track.stop());
      setState("stop");
    });

    recorder.current?.addEventListener("start", (e) => {
      duration.current = Date.now();
      setState("recording");
    });
  };

  const stop = () => {
    recorder.current?.requestData();
    recorder.current?.stop();
  };

  const pause = () => {
    recorder.current?.pause();
  };

  const resume = () => {
    recorder.current?.resume();
  };

  const getBlobs = async () => {
    try {
      const superblob = new Blob([...blobs.current], { type });
      const arrayBuffer = await superblob.arrayBuffer();

      if (arrayBuffer) return getSeekableWebM(arrayBuffer);
      return superblob;
    } catch (e) {
      console.error(e);
      return undefined;
    }
  };

  return {
    stop,
    start,
    state,
    pause,
    resume,
    getBlobs,
    duration: duration.current,
  };
};

export default useRecorder;
