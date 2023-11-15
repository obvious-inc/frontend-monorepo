import React from "react";

const usePageTitle = (title) => {
  const initialTitleRef = React.useRef();

  React.useEffect(() => {
    if (initialTitleRef.current == null)
      initialTitleRef.current = document.title;

    return () => {
      document.title = initialTitleRef.current;
    };
  }, []);

  React.useEffect(() => {
    if (title == null) return;
    document.title = title;
  }, [title]);
};

export default usePageTitle;
