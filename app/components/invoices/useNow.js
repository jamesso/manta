import { useEffect, useState } from 'react';

export function useNow() {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const onFocus = () => setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  return now;
}
