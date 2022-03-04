import { functionUtils } from "@shades/common";

const { compose } = functionUtils;

export const mergePlugins = (plugins) => {
  const middleware = compose(
    ...plugins.filter((p) => p.middleware != null).map((p) => p.middleware)
  );

  const elements = plugins.reduce(
    (acc, p) => (p.elements == null ? acc : { ...acc, ...p.elements }),
    []
  );

  const pipeEventHandler =
    (handler) =>
    (e, ...rest) => {
      handler?.(e, ...rest);
      return e;
    };

  const handlers = {
    onChange: compose(
      ...plugins.map((p) => pipeEventHandler(p.handlers?.onChange))
    ),
    onKeyDown: compose(
      ...plugins.map((p) => pipeEventHandler(p.handlers?.onKeyDown))
    ),
  };

  return { middleware, elements, handlers };
};

export const createEmptyParagraph = () => ({
  type: "paragraph",
  children: [{ text: "" }],
});

export const isNodeEmpty = (el) => {
  return el.children == null
    ? el.text.trim() === ""
    : el.children.every(isNodeEmpty);
};

export const cleanNodes = (nodes) =>
  nodes.reduce(
    (acc, n) =>
      isNodeEmpty(n)
        ? acc
        : [
            ...acc,
            n.children == null ? n : { ...n, children: cleanNodes(n.children) },
          ],
    []
  );
