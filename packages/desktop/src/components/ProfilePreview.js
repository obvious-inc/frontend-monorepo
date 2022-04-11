
import React from 'react';
import throttle from "lodash.throttle";
import { styled, keyframes } from '@stitches/react';
import * as Popover from '@radix-ui/react-popover';
import { css, useTheme } from "@emotion/react";
import { useAppScope } from "@shades/common";
import { NewMessageInput } from './channel';
import { createEmptyParagraph, isNodeEmpty, cleanNodes } from "../slate/utils";
import useCommands from "../hooks/commands";
import Spinner from "./spinner";

  
const ProfilePreview = ({
  displayName,
  walletAddress,
  trigger,
  avatar,
  channelId,
  serverId,
  isOwnMessage,
}) => { 
  const inputRef = React.useRef();
  const [open,setIsOpen] = React.useState(false)
  const theme = useTheme();
  const StyledContent = styled(Popover.Content, {
    borderRadius: 3,
    padding: '20px',
    paddingBottom:"5px",
    backgroundColor: theme.colors.backgroundPrimaryAlt,
    color: theme.colors.textNormal,
  });
  
  const PopoverContent = StyledContent;
const {
  execute: executeCommand,
  isCommand,
  commands,
} = useCommands({
  context: "dm",
  serverId,
  channelId,
});



const [pendingMessage, setPendingMessage] = React.useState(() => [
  createEmptyParagraph(),
]);
const { actions, state } = useAppScope();
const [isPending, setPending] = React.useState(false);
const throttledRegisterTypingActivity = React.useMemo(
  () =>
    throttle(() => actions.registerChannelTypingActivity(channelId), 3000, {
      trailing: false,
    }),
  [actions, channelId]
);
const executeMessage = async () => {
  const blocks = cleanNodes(pendingMessage);

  const isEmpty = blocks.every(isNodeEmpty);

  if (
    isEmpty &&
    // We want to allow "empty" messages if it has attachements
    imageUploads.length === 0
  )
    return;

  const messageString = editorRef.current.string();

  if (messageString.startsWith("/")) {
    const [commandName, ...args] = messageString
      .slice(1)
      .split(" ")
      .map((s) => s.trim())
      .filter(Boolean);

    if (isCommand(commandName)) {
      setPending(true);
      try {
        await executeCommand(commandName, {
          args,
          editor: editorRef.current,
        });
      } catch (e) {
        alert(e.message);
      }
      setPending(false);
      return;
    }
  }

  // Regular submit if we don’t have pending file uploads
  if (imageUploads.length === 0 && uploadPromiseRef.current == null) {
    editorRef.current.clear();
    return submit(blocks);
  }

  const submitWithAttachments = (attachments) => {
    editorRef.current.clear();
    setImageUploads([]);

    const attachmentsBlock = {
      type: "attachments",
      children: attachments.map((u) => ({
        type: "image-attachment",
        url: u.url,
        width: u.width,
        height: u.height,
      })),
    };

    return submit([...blocks, attachmentsBlock]);
  };

  if (uploadPromiseRef.current == null)
    return submitWithAttachments(imageUploads);

  // Craziness otherwise
  try {
    setPending(true);
    const attachments = await uploadPromiseRef.current.then();
    // Only mark as pending during the upload phase. We don’t want to wait
    // for the message creation to complete since the UI is optimistic
    // and adds the message right away
    setPending(false);
    submitWithAttachments(attachments);
  } catch (e) {
    setPending(false);
    return Promise.reject(e);
  }
};
  return (
    <Popover.Root
    open={open}
    onOpenChange={(isOpen) => {
      setIsOpen(isOpen);
    }}
  >
    <Popover.Trigger>
 {trigger}
 </Popover.Trigger>
    <PopoverContent
      side="right"
      align="end"
    >
 <div style={{display: "flex", flexDirection:"column", justifyContent: "space-evenly"}}>
   <div style={{display: "flex", flexWrap: "nowrap", alignItems:"center"}}>
      {avatar}
       <h2 style={{fontWeight: '100',textAlign:"center", flexGrow: '0.75'}}>{displayName} </h2>
       </div>
       <h3 style={{fontWeight: '100'}}>Wallet address</h3>
       <h6 style={{margin: '0', marginTop: '5px', fontSize: "11px"}}>{walletAddress}</h6>   
       <div style={{paddingTop: "10px"}}>
  <h3 style={{fontWeight: '100'}}>About me</h3>
  <h5 style={{fontSize: '12px', margin: '0'}}>This is where the user description will be</h5>  
  </div>
  <div style={{paddingTop: "6px"}}>
  <h3 style={{fontWeight: '100'}}>Roles</h3> 
  <h6 style={{margin: '0'}}>Roles here</h6> 
  </div>
  {!isOwnMessage &&
        <NewMessageInput
          ref={inputRef}
          isDM={false}
          serverId={serverId}
          channelId={channelId}
          replyingToMessage={
           null
          }
          cancelReply={() => {
            inputRef.current.focus();
          }}
          uploadImage={actions.uploadImage}
          submit={async (blocks) => {
            if(blocks) {
            await executeCommand('dm', {
              args:[[walletAddress],blocks],
              editor: inputRef.current,
            })
            
            //TODO: add a loading state
            setIsOpen(false)
          }
          }}
          placeholder={ `Send DM to ${displayName}!`
          }
          members={[]}
          getUserMentionDisplayName={displayName}
          onInputChange={(blocks) => {

          }}
        />
}
  </div>
    </PopoverContent>
  </Popover.Root>
)
};

export default ProfilePreview