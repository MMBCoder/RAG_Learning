"use client";

import { useEffect, useRef } from "react";
import { director } from "../motion/director";

/* §B2: the ONE element GSAP owns. The rig wraps the canvas only —
   chrome fades instead of scaling, so fixed/sticky UI never fights the
   camera. */

export default function CameraRig({ children }: { children: React.ReactNode }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const rigRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (viewportRef.current && rigRef.current) {
      director.attach(viewportRef.current, rigRef.current);
    }
    return () => director.detach();
  }, []);

  return (
    <div ref={viewportRef} style={{ borderRadius: 14 }}>
      <div ref={rigRef} style={{ transformOrigin: "0 0", willChange: "transform" }}>
        {children}
      </div>
    </div>
  );
}
