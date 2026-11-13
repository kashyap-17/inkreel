"use client";

// Tester mode: shows engineering details (photo details, error text, the test record) and sends
// the test record to the server log. Off by default; opening the app once with ?tester=1 turns it
// on for that device, ?tester=0 turns it off.
import { createContext, useContext } from "react";

const KEY = "inkreel.tester";

export function readTesterMode(): boolean {
  try {
    const flag = new URLSearchParams(window.location.search).get("tester");
    if (flag === "1") localStorage.setItem(KEY, "1");
    else if (flag === "0") localStorage.removeItem(KEY);
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export const TesterContext = createContext(false);

export const useTester = () => useContext(TesterContext);
