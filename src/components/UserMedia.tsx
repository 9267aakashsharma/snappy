import React, { useEffect, useRef } from "react";
import Draggable from "react-draggable";
import styled from "styled-components";

const UserMedia = ({ stream }: { stream: MediaStream | null }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoWrapperRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    const element = document.getElementById("snappy-camera-root");
    if (!element) return;
    let pos1 = 0,
      pos2 = 0,
      pos3 = 0,
      pos4 = 0;

    e = e || window.event;
    e.preventDefault();
    // get the mouse cursor position at startup:
    pos3 = e.clientX;
    pos4 = e.clientY;

    document.onmouseup = closeDragElement;
    // call a function whenever the cursor moves:
    document.onmousemove = elementDrag;

    function elementDrag(e: MouseEvent) {
      if (!element) return;
      e = e || window.event;
      e.preventDefault();
      // calculate the new cursor position:
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      // set the element's new position:
      element.style.top = element.offsetTop - pos2 + "px";
      element.style.left = element.offsetLeft - pos1 + "px";
    }

    function closeDragElement() {
      // stop moving when mouse button is released:
      document.onmouseup = null;
      document.onmousemove = null;
    }
  };

  useEffect(() => {
    if (!videoRef.current || !stream) return;
    videoRef.current.srcObject = stream;
  }, [stream]);

  if (!stream) return null;

  return (
    <Draggable
      defaultPosition={{
        x: 10,
        y: window.innerHeight - 140,
      }}
    >
      <UserMediaWrapper ref={videoWrapperRef} onMouseDown={handleMouseDown}>
        <video
          ref={videoRef}
          muted
          autoPlay
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            borderRadius: "50%",
          }}
        />
      </UserMediaWrapper>
    </Draggable>
  );
};

export default UserMedia;

const UserMediaWrapper = styled.div`
  width: 8rem;
  height: 8rem;
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: 50%;
  background-color: #fff;
  z-index: 2147483647;
  pointer-events: all;
  cursor: move;
  position: absolute;
  user-select: none;
`;
