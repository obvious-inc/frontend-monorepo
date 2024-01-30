import React from "react";
import {
  useRouter,
  usePathname,
  useSearchParams as useNextSearchParams,
} from "next/navigation";

export const useNavigate = () => {
  const router = useRouter();
  return React.useCallback(
    (to, { replace = false } = {}) => {
      if (replace) {
        router.replace(to);
        return;
      }

      router.push(to);
    },
    [router]
  );
};

export const useSearchParams = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useNextSearchParams();

  const set = React.useCallback(
    (input_) => {
      const input =
        typeof input_ === "function" ? input_(searchParams) : input_;
      const params = new URLSearchParams(input);
      router.push(pathname + "?" + params.toString());
    },
    [router, pathname, searchParams]
  );

  return [searchParams, set];
};
