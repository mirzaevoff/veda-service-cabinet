"use client";

import { useEffect, useState } from "react";

/**
 * Отложенный флаг для скелетонов: при быстрой загрузке (< delayMs)
 * скелетон вообще не мигает.
 */
export function useDelayed(active: boolean, delayMs = 250): boolean {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!active) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- мгновенный сброс при завершении загрузки
      setShow(false);
      return;
    }
    const id = setTimeout(() => setShow(true), delayMs);
    return () => clearTimeout(id);
  }, [active, delayMs]);

  return show;
}
