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
    [router],
  );
};

export const useSearchParams = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useNextSearchParams();

  const set = React.useCallback(
    (input_, options) => {
      const input =
        typeof input_ === "function" ? input_(searchParams) : input_;
      const params = new URLSearchParams(input);

      const href = pathname + "?" + params.toString();

      if (options?.replace) {
        router.replace(href);
        return;
      }

      router.push(href);
    },
    [router, pathname, searchParams],
  );

  return [searchParams, set];
};

export const useSearchParamToggleState = (
  key,
  { replace = true, prefetch = false } = {},
) => {
  const router = useRouter();
  const pathname = usePathname();
  const [searchParams, setSearchParams] = useSearchParams();

  const isToggled = searchParams.get(key) != null;

  const getToggledSearchParams = React.useCallback(
    (params) => {
      const newParams = new URLSearchParams(params);

      if (newParams.get(key) == null) {
        newParams.set(key, 1);
        return newParams;
      }

      newParams.delete(key);
      return newParams;
    },
    [key],
  );

  const toggle = React.useCallback(() => {
    setSearchParams((params) => getToggledSearchParams(params), { replace });
  }, [replace, getToggledSearchParams, setSearchParams]);

  React.useEffect(() => {
    if (!prefetch) return;
    const newParams = getToggledSearchParams(searchParams);
    router.prefetch(pathname + "?" + newParams);
  }, [router, pathname, getToggledSearchParams, searchParams, prefetch]);

  return [isToggled, toggle];
};
