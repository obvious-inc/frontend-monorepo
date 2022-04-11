
import React from 'react';

import { styled } from '@stitches/react';
import * as Popover from '@radix-ui/react-popover';
import { css, useTheme } from "@emotion/react";
import { useAppScope } from "@shades/common";
import Button from "./button";
import { useNavigate } from "react-router-dom";
import { getChecksumAddress } from "../utils/ethereum";
  
const ProfilePreview = ({
  displayName,
  isOnline,
  walletAddress,
  trigger,
  avatar,
  authorUserId,
  isOwnMessage,
}) => { 
  const [open,setIsOpen] = React.useState(false)
  const theme = useTheme();
  const navigate = useNavigate();
  const StyledContent = styled(Popover.Content, {
    borderRadius: 3,
    padding: '20px',
    paddingBottom:"5px",
    backgroundColor: theme.colors.backgroundPrimaryAlt,
    color: theme.colors.textNormal,
  });
  
  const PopoverContent = StyledContent;

const { actions, state} = useAppScope();
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
      <Button
      variant="primary"
      size="large"
      onClick={async ()=> {
        const redirect = (c) => navigate(`/channels/@me/${c.id}`);
        const dmChannel = state.selectDmChannelFromUserId(
          authorUserId
        );
        if (dmChannel != null) {
          redirect(dmChannel);
          return;
        }

        actions
          .createChannel({
            kind: "dm",
            memberUserIds: [authorUserId],
          })
          .then(redirect);
      } }
    >
      Message
    </Button>
}
  </div>
    </PopoverContent>
  </Popover.Root>
)
};

export default ProfilePreview