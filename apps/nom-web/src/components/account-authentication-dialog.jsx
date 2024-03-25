import { css } from "@emotion/react";
import { useAuth } from "@shades/common/app";
import Emoji from "@shades/ui-web/emoji";
import DialogHeader from "@shades/ui-web/dialog-header";
import DialogFooter from "@shades/ui-web/dialog-footer";
import LoginScreen from "./login-screen";

const AccountAuthenticationDialog = ({
  title,
  subtitle,
  titleProps,
  dismiss,
}) => {
  const { status: authenticationStatus } = useAuth();
  const isAuthenticated = authenticationStatus === "authenticated";

  return (
    <div
      css={css({
        padding: "1.5rem",
        "@media (min-width: 600px)": {
          padding: "var(--padding)",
        },
      })}
      style={{ "--padding": isAuthenticated ? "2rem" : "2rem 2rem 4rem" }}
    >
      <DialogHeader
        title={isAuthenticated ? "Account verified" : title ?? "Verify account"}
        subtitle={subtitle}
        titleProps={titleProps}
        dismiss={dismiss}
      />

      {isAuthenticated ? (
        <>
          <main
            style={{ fontSize: "3rem", textAlign: "center", padding: "4rem 0" }}
          >
            <Emoji emoji="🎉" />
          </main>
          <DialogFooter cancel={dismiss} cancelButtonLabel="Close" />
        </>
      ) : (
        <main>
          <LoginScreen />
        </main>
      )}
    </div>
  );
};

export default AccountAuthenticationDialog;
