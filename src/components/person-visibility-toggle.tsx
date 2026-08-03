"use client";

import { useState } from "react";
import { togglePersonPublicVisibility } from "@/lib/actions/person";

interface Props {
  accessCode: string;
  publicVisible: boolean;
}

export function PersonVisibilityToggle({ accessCode, publicVisible }: Props) {
  const [visible, setVisible] = useState(publicVisible);

  async function toggle() {
    const fd = new FormData();
    fd.append("accessCode", accessCode);
    await togglePersonPublicVisibility(fd);
    setVisible((v) => !v);
  }

  return (
    <button
      onClick={toggle}
      aria-pressed={!visible}
      className="text-xs tracking-widest uppercase text-zinc-500 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-white border border-zinc-300 dark:border-zinc-700 hover:border-zinc-900 dark:hover:border-white px-3 py-1.5 transition-colors cursor-pointer"
    >
      {visible ? "OCULTAR PÁGINA PÚBLICA" : "REATIVAR PÁGINA PÚBLICA"}
    </button>
  );
}
