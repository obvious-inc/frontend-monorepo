import React from "react";

const FlexGridContext = React.createContext();

export const Grid = ({ gridGap = 0, children, ...props }) => (
  <FlexGridContext.Provider value={{ gridGap }}>
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        margin: `calc(${gridGap} * -1) 0 0 calc(${gridGap} * -1)`,
        ...props.style,
      }}
      {...props}
    >
      {children}
    </div>
  </FlexGridContext.Provider>
);

export const Item = ({ children, ...props }) => {
  const { gridGap } = React.useContext(FlexGridContext);
  return (
    <div
      style={{ margin: `${gridGap} 0 0 ${gridGap}`, ...props.style }}
      {...props}
    >
      {children}
    </div>
  );
};
