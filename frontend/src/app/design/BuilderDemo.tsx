"use client";

import { useState } from "react";
import { CharacterBuilder } from "@/components/game/CharacterBuilder";
import type { Character } from "@/components/game/avatar/characters";

const START: Character = { shape: "heart", color: "pink", face: "happy" };

export function BuilderDemo() {
  const [character, setCharacter] = useState<Character>(START);
  return <CharacterBuilder value={character} onChange={setCharacter} className="max-w-[360px]" />;
}
