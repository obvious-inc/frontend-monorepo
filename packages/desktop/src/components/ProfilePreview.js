
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
  isOnline,
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
const { actions, state } = useAppScope();
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
   <div style={{display: "flex", flexDirection:"row",flexWrap: "nowrap", alignItems:"flex-start", justifyContent:"center"}}>
      {avatar}
      <div style={{display: "flex", flexDirection:"row", justifyContent: "center", flexGrow: '1'}}>
        
       <h2 style={{fontWeight: '100'}}>{displayName} </h2>
       { isOnline && (
       <div
                css={(theme) =>
                  css({
                    marginTop: "12px",
                    marginLeft: "5px",
                    width: "1rem",
                    height: "1rem",
                    borderRadius: "50%",
                    background: theme.colors.onlineIndicator,
                  })
                }
              />
       )
}
            
       </div>
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
          isDM={true}
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
          placeholder={`Send a DM to ${displayName}!`
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