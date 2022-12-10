export interface StartRecordingProps {
  streamId: string;
  options?: any;
}

export interface StopRecordingProps {
  blob: Blob;
}

export interface RedirectProps {
  url: string;
  options?: any;
}

export interface SetBadgeProps {
  text: chrome.action.BadgeTextDetails;
  color: chrome.action.BadgeBackgroundColorDetails;
}

export enum MessageTypes {
  getStream = "get-stream",
  redirect = "redirect-to-url",
  startRecording = "start-recording",
  stopRecording = "stop-recording",
  setBadge = "set-badge",
  iconClicked = "icon-clicked",
}

export type Message =
  | {
      payload: StartRecordingProps;
      type: MessageTypes.startRecording;
    }
  | {
      payload: StopRecordingProps;
      type: MessageTypes.stopRecording;
    }
  | {
      payload: RedirectProps;
      type: MessageTypes.redirect;
    }
  | {
      payload: SetBadgeProps;
      type: MessageTypes.setBadge;
    }
  | {
      type: MessageTypes.iconClicked;
    }
  | {
      type: MessageTypes.getStream;
    };

export enum MessageResponseTypes {
  success = "success",
  error = "error",
  redirect = "redirect",
}

export type MessageResponse = {
  type: MessageResponseTypes;
  success: boolean;
  message: string;
  payload?: any;
};
