const clientDataById = {
  1: { url: "https://studio.noundry.wtf", name: "Noundry" },
  2: {
    url: null, // "https://houseofnouns.wtf"
    name: "House of Nouns",
  },
  3: { url: "https://www.nouns.camp", name: "Camp" },
  4: { url: "https://nouns.biz", name: "nouns.biz" },
  5: { url: "https://www.nounswap.wtf", name: "NounSwap" },
  6: { url: "https://www.nouns.game", name: "nouns.game" },
  7: { url: "https://nouns.sh", name: "Nouns Terminal" },
  8: { url: "https://nouns.gg", name: "Nouns GG" },
  9: { url: "https://www.probe.wtf", name: "Probe" },
  10: { url: "https://nounsagora.com", name: "Nouns Agora" },
  11: { url: "https://nouns.farm", name: "Nouns Farm" },
  12: {
    url: null, // "https://proplaunchpad.com"
    name: "Prop Launchpad",
  },
  13: { url: "https://www.etherscan.io", name: "Etherscan" },
  14: { url: "https://pronouns.gg", name: "Pronouns" },
  15: { url: "https://nouns.auction", name: "nouns.auction" },
  16: { url: "https://lighthouse.cx", name: "Lighthouse" },
  17: { url: "https://protocol.nouns.camp", name: "Nouns Protocol" },
  18: { url: "https://anouns.eth.limo/", name: "anouns" },
  19: { url: "https://www.etherscan.io", name: "Etherscan" },
};

export const getClientData = (id) => clientDataById[id];
