import AccountPreviewPopoverTrigger from "@shades/ui-web/account-preview-popover-trigger";

const AccountPreviewPopoverTriggerWithActions = ({ userId, ...props }, ref) => {
  return (
    <AccountPreviewPopoverTrigger
      ref={ref}
      userId={userId}
      // accountActions={actions}
      {...props}
    />
  );
};

export default AccountPreviewPopoverTriggerWithActions;
