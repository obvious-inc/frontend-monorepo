import React from 'react';
import { createSelector } from 'reselect';

const useLatestCallback = (callback)=>{
    const callbackRef = React.useRef(callback);
    React.useLayoutEffect(()=>{
        callbackRef.current = callback;
    });
    return React.useCallback(function() {
        for(var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++){
            args[_key] = arguments[_key];
        }
        return callbackRef.current(...args);
    }, []);
};

function _extends() {
    _extends = Object.assign || function(target) {
        for(var i = 1; i < arguments.length; i++){
            var source = arguments[i];
            for(var key in source){
                if (Object.prototype.hasOwnProperty.call(source, key)) {
                    target[key] = source[key];
                }
            }
        }
        return target;
    };
    return _extends.apply(this, arguments);
}
const ACCESS_TOKEN_CACHE_KEY = "access-token";
const REFRESH_TOKEN_CACHE_KEY = "refresh-token";
let defaultStorage;
try {
    defaultStorage = window.localStorage;
} catch (e) {
    console.warn(e);
}
const createAsyncWebStorage = function() {
    let storage = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : defaultStorage;
    return {
        async getItem () {
            for(var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++){
                args[_key] = arguments[_key];
            }
            return storage.getItem(...args);
        },
        async setItem () {
            for(var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++){
                args[_key] = arguments[_key];
            }
            return storage.setItem(...args);
        },
        async removeItem () {
            for(var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++){
                args[_key] = arguments[_key];
            }
            return storage.removeItem(...args);
        }
    };
};
const asyncWebStorage = createAsyncWebStorage();
const useAccessToken = function() {
    let { storage =asyncWebStorage  } = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
    const storageRef = React.useRef(storage);
    const [token, setToken] = React.useState(undefined);
    const tokenRef = React.useRef();
    React.useEffect(()=>{
        storageRef.current = storage;
    });
    const set = React.useCallback((token)=>{
        tokenRef.current = token;
        setToken(token);
        try {
            if (token == null) storageRef.current.removeItem(ACCESS_TOKEN_CACHE_KEY);
            else storageRef.current.setItem(ACCESS_TOKEN_CACHE_KEY, token);
        } catch (e) {
        // Ignore
        }
    }, []);
    const clear = React.useCallback(()=>{
        tokenRef.current = null;
        setToken(null);
        try {
            storageRef.current.removeItem(ACCESS_TOKEN_CACHE_KEY);
        } catch (e) {
        // Ignore
        }
    }, []);
    React.useEffect(()=>{
        storageRef.current.getItem(ACCESS_TOKEN_CACHE_KEY).then((maybeToken)=>{
            tokenRef.current = maybeToken ?? null;
            setToken(maybeToken ?? null);
        }, ()=>{
            setToken(null);
        });
    }, []);
    return [
        token,
        {
            set,
            clear,
            ref: tokenRef
        }
    ];
};
let pendingRefreshAccessTokenPromise;
const useRefreshToken = function() {
    let { storage =asyncWebStorage  } = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
    const storageRef = React.useRef(storage);
    const tokenRef = React.useRef();
    React.useEffect(()=>{
        storageRef.current = storage;
    });
    const set = React.useCallback((token)=>{
        tokenRef.current = token;
        try {
            if (token == null) storageRef.current.removeItem(REFRESH_TOKEN_CACHE_KEY);
            else storageRef.current.setItem(REFRESH_TOKEN_CACHE_KEY, token);
        } catch (e) {
        // Ignore
        }
    }, []);
    const clear = React.useCallback(()=>{
        tokenRef.current = null;
        try {
            storageRef.current.removeItem(REFRESH_TOKEN_CACHE_KEY);
        } catch (e) {
        // Ignore
        }
    }, []);
    React.useEffect(()=>{
        storageRef.current.getItem(REFRESH_TOKEN_CACHE_KEY).then((maybeToken)=>{
            tokenRef.current = maybeToken ?? null;
        });
    }, []);
    return [
        tokenRef,
        {
            set,
            clear
        }
    ];
};
const Context$2 = /*#__PURE__*/ React.createContext({});
const useAuth = ()=>React.useContext(Context$2);
const Provider$2 = (param)=>{
    let { apiOrigin , tokenStorage =asyncWebStorage , ...props } = param;
    const [accessToken, { set: setAccessToken , clear: clearAccessToken , ref: accessTokenRef  }, ] = useAccessToken({
        storage: tokenStorage
    });
    const [refreshTokenRef, { set: setRefreshToken , clear: clearRefreshToken  }] = useRefreshToken({
        storage: tokenStorage
    });
    const status = accessToken === undefined ? "loading" : accessToken == null ? "not-authenticated" : "authenticated";
    const login = useLatestCallback(async (param)=>{
        let { message , signature , address , signedAt , nonce  } = param;
        const responseBody = await fetch(`${apiOrigin}/auth/login`, {
            method: "POST",
            body: JSON.stringify({
                message,
                signature,
                address,
                signed_at: signedAt,
                nonce
            }),
            headers: {
                "Content-Type": "application/json"
            }
        }).then((response)=>{
            if (response.ok) return response.json();
            return Promise.reject(new Error(response.statusText));
        });
        setAccessToken(responseBody.access_token);
        setRefreshToken(responseBody.refresh_token);
    });
    const logout = useLatestCallback(()=>{
        setAccessToken(null);
        setRefreshToken(null);
    });
    const refreshAccessToken = useLatestCallback(async ()=>{
        if (pendingRefreshAccessTokenPromise != null) return pendingRefreshAccessTokenPromise;
        const refreshToken = refreshTokenRef.current;
        if (refreshToken == null) throw new Error("Missing refresh token");
        const run = async ()=>{
            const responseBody = await fetch(`${apiOrigin}/auth/refresh`, {
                method: "POST",
                body: JSON.stringify({
                    refresh_token: refreshToken
                }),
                headers: {
                    "Content-Type": "application/json"
                }
            }).then((response)=>{
                if (response.ok) return response.json();
                clearAccessToken();
                clearRefreshToken();
                return Promise.reject(new Error(response.statusText));
            });
            setAccessToken(responseBody.access_token);
            setRefreshToken(responseBody.refresh_token);
            return responseBody.access_token;
        };
        const promise = run();
        pendingRefreshAccessTokenPromise = promise;
        const accessToken = await promise;
        pendingRefreshAccessTokenPromise = null;
        return accessToken;
    });
    const authorizedFetch = useLatestCallback(async (url, options)=>{
        const accessToken = accessTokenRef.current;
        const requireAccessToken = !(options === null || options === void 0 ? void 0 : options.allowUnauthorized) && !(options === null || options === void 0 ? void 0 : options.unauthorized);
        if (requireAccessToken && accessToken == null) throw new Error("Missing access token");
        const headers = new Headers(options === null || options === void 0 ? void 0 : options.headers);
        if (!(options === null || options === void 0 ? void 0 : options.unauthorized) && accessToken != null && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${accessToken}`);
        const response = await fetch(`${apiOrigin}${url}`, {
            ...options,
            headers
        });
        if (accessToken != null && response.status === 401) {
            try {
                const newAccessToken = await refreshAccessToken();
                const headers1 = new Headers(options === null || options === void 0 ? void 0 : options.headers);
                headers1.set("Authorization", `Bearer ${newAccessToken}`);
                return authorizedFetch(url, {
                    ...options,
                    headers: headers1
                });
            } catch (e) {
                // Sign out if the access token refresh doesn’t succeed
                logout();
            }
        }
        if (!response.ok) {
            const error = new Error(response.statusText);
            error.code = response.status;
            return Promise.reject(error);
        }
        if (response.status === 204) return undefined;
        return response.json();
    });
    const verifyAccessToken = useLatestCallback(()=>{
        // This will have to do for now
        return authorizedFetch("/users/me").then(()=>null);
    });
    const contextValue = React.useMemo(()=>({
            status,
            accessToken,
            apiOrigin,
            authorizedFetch,
            login,
            logout,
            setAccessToken,
            verifyAccessToken,
            refreshAccessToken
        }), [
        status,
        accessToken,
        apiOrigin,
        authorizedFetch,
        login,
        logout,
        setAccessToken,
        verifyAccessToken,
        refreshAccessToken
    ]);
    return /*#__PURE__*/ React.createElement(Context$2.Provider, _extends({
        value: contextValue
    }, props));
};

let prevDummyId = 0;
const generateDummyId = ()=>{
    const id = prevDummyId++;
    prevDummyId = id;
    return id;
};
const isTouchDevice = ()=>"ontouchstart" in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0;
const getImageFileDimensions = (imageFile)=>new Promise((resolve, reject)=>{
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = ()=>{
            // is the data URL because called with readAsDataURL
            getImageDimensionsFromUrl(reader.result).then(resolve, reject);
        };
        reader.readAsDataURL(imageFile);
    });
const getImageDimensionsFromUrl = (url)=>new Promise((resolve, reject)=>{
        const img = new Image();
        img.onerror = reject;
        img.onload = ()=>{
            resolve({
                width: img.naturalWidth,
                height: img.naturalHeight
            });
        };
        img.src = url;
    });

const invariant = (condition, message)=>{
    if (condition) return;
    const error = new Error(message);
    error.name = "Invariant violation";
    throw error;
};

const omitKey = (key, obj)=>omitKeys([
        key
    ], obj);
const omitKeys = (keys, obj)=>Object.fromEntries(Object.entries(obj).filter((param)=>{
        let [key_] = param;
        return !keys.includes(key_);
    }));
const mapValues = (mapper, obj)=>Object.fromEntries(Object.entries(obj).map((param)=>{
        let [key, value] = param;
        return [
            key,
            mapper(value, key, obj)
        ];
    }));
const filter$1 = (predicate, obj)=>Object.fromEntries(Object.entries(obj).filter(predicate));

var object = /*#__PURE__*/Object.freeze({
  __proto__: null,
  omitKey: omitKey,
  omitKeys: omitKeys,
  mapValues: mapValues,
  filter: filter$1
});

function combineReducers(reducers) {
    const reducerKeys = Object.keys(reducers);
    return function combination() {
        let state = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {}, action = arguments.length > 1 ? arguments[1] : void 0;
        let hasChanged = false;
        const nextState = {};
        for(let i = 0; i < reducerKeys.length; i++){
            const key = reducerKeys[i];
            const reducer = reducers[key];
            const previousStateForKey = state[key];
            const nextStateForKey = reducer(previousStateForKey, action);
            nextState[key] = nextStateForKey;
            hasChanged = hasChanged || nextStateForKey !== previousStateForKey;
        }
        hasChanged = hasChanged || reducerKeys.length !== Object.keys(state).length;
        return hasChanged ? nextState : state;
    };
}

const indexBy = (computeKey, list)=>list.reduce((acc, item)=>{
        acc[computeKey(item, list)] = item;
        return acc;
    }, {});
const groupBy = (computeKey, list)=>list.reduce((acc, item)=>{
        const key = computeKey(item, list);
        const group = acc[key] ?? [];
        acc[key] = [
            ...group,
            item
        ];
        return acc;
    }, {});
const unique = (list)=>[
        ...new Set(list)
    ];
const reverse = (list)=>[
        ...list
    ].reverse();
const sort = (comparator, list)=>[
        ...list
    ].sort(comparator);

var array = /*#__PURE__*/Object.freeze({
  __proto__: null,
  indexBy: indexBy,
  groupBy: groupBy,
  unique: unique,
  reverse: reverse,
  sort: sort
});

const arrayShallowEquals = (v1, v2)=>{
    if (v1.length !== v2.length) return false;
    return v1.every((v, i)=>v === v2[i]);
};

const variantNameBySizeName = {
    small: "avatar",
    large: "public"
};
const buildUrl = (cloudflareId, size)=>{
    const variant = variantNameBySizeName[size];
    if (variant == null) throw new Error();
    return `https://imagedelivery.net/${process.env.CLOUDFLARE_ACCT_HASH}/${cloudflareId}/${variant}`;
};
const build = (pfp)=>{
    if (pfp == null) return {
        small: null,
        large: null
    };
    if (pfp.cf_id == null) return {
        small: pfp.input_image_url,
        large: pfp.input_image_url
    };
    return {
        small: buildUrl(pfp.cf_id, "small"),
        large: buildUrl(pfp.cf_id, "large"),
        isVerifiedNft: pfp.verified
    };
};

const entriesById$3 = function() {
    let state = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {}, action = arguments.length > 1 ? arguments[1] : void 0;
    switch(action.type){
        case "fetch-channel-members-request-successful":
            return {
                ...state,
                ...indexBy((m)=>m.id, action.members)
            };
        case "fetch-users-request-successful":
            return {
                ...state,
                ...indexBy((m)=>m.id, action.users)
            };
        case "server-event:user-profile-updated":
            return mapValues((user)=>{
                if (user.id !== action.data.user) return user;
                return {
                    ...user,
                    ...omitKeys([
                        "user"
                    ], action.data)
                };
            }, state);
        case "server-event:channel-user-joined":
        case "server-event:channel-user-invited":
            return {
                ...state,
                [action.data.user.id]: action.data.user
            };
        case "server-event:user-presence-updated":
            return mapValues((user)=>{
                if (user.id !== action.data.user.id) return user;
                return {
                    ...user,
                    status: action.data.user.status
                };
            }, state);
        case "logout":
            return {};
        default:
            return state;
    }
};
const selectAllUsers = (state)=>Object.keys(state.users.entriesById).map((userId)=>selectUser(state, userId));
const selectUser = createSelector((state, userId)=>{
    var ref;
    return ((ref = state.me.user) === null || ref === void 0 ? void 0 : ref.id) === userId ? {
        ...state.me.user,
        ...state.users.entriesById[userId]
    } : state.users.entriesById[userId];
}, (state)=>state.me.user, (user, loggedInUser)=>{
    if (user == null) return null;
    const isLoggedInUser = user.id === (loggedInUser === null || loggedInUser === void 0 ? void 0 : loggedInUser.id);
    return {
        ...user,
        displayName: user.display_name,
        walletAddress: user.wallet_address,
        onlineStatus: isLoggedInUser ? "online" : user.status,
        profilePicture: build(user.pfp)
    };
}, {
    memoizeOptions: {
        maxSize: 1000
    }
});
const selectUsers = createSelector((state, userIds)=>userIds.map((userId)=>selectUser(state, userId)).filter(Boolean), (users)=>users, {
    memoizeOptions: {
        equalityCheck: arrayShallowEquals
    }
});
const selectUserFromWalletAddress = (state, address)=>selectAllUsers(state).find((u)=>u.walletAddress.toLowerCase() === address.toLowerCase());
var users = combineReducers({
    entriesById: entriesById$3
});

const user = function() {
    let state = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : null, action = arguments.length > 1 ? arguments[1] : void 0;
    switch(action.type){
        case "fetch-me-request-successful":
            return action.user;
        case "fetch-client-boot-data-request-successful":
            return action.user;
        case "logout":
            return null;
        default:
            return state;
    }
};
const selectMe = (state)=>{
    var ref;
    return state.me.user == null ? null : selectUser(state, (ref = state.me.user) === null || ref === void 0 ? void 0 : ref.id);
};
var me = combineReducers({
    user
});

const initialState$1 = {
    hasFetchedInitialData: false
};
const reducer = function() {
    let state = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : initialState$1, action = arguments.length > 1 ? arguments[1] : void 0;
    switch(action.type){
        case "initial-data-request-successful":
            return {
                ...state,
                hasFetchedInitialData: true
            };
        case "fetch-client-boot-data-request-successful":
        case "fetch-user-channels-request-successful":
            return {
                ...state,
                hasFetchedUserChannels: true
            };
        case "fetch-starred-channels-request-successful":
            return {
                ...state,
                hasFetchedStarredChannels: true
            };
        case "logout":
            return initialState$1;
        default:
            return state;
    }
};
const selectHasFetchedInitialData = (state)=>state.ui.hasFetchedInitialData;
const selectHasFetchedMenuData = (state)=>state.ui.hasFetchedUserChannels && state.ui.hasFetchedStarredChannels;

const iterate = (fn, nodes)=>{
    for (let node of nodes){
        fn(node);
        if (node.children == null) continue;
        iterate(fn, node.children);
    }
};
const map = (fn, nodes)=>{
    const mappedNodes = [];
    for (let [index, node] of nodes.entries()){
        if (node.children != null) node.children = map(node.children, fn);
        mappedNodes.push(fn(node, index));
    }
    return mappedNodes;
};
const filter = (predicate, nodes)=>{
    const filteredNodes = [];
    for (let [index, node] of nodes.entries()){
        if (node.children != null) node.children = filter(predicate, node.children);
        if (!predicate(node, index)) continue;
        filteredNodes.push(node);
    }
    return filteredNodes;
};
const getMentions = (nodes)=>{
    const mentions = [];
    iterate((node)=>{
        if (node.type === "user") mentions.push(node);
    }, nodes);
    return mentions;
};
const withoutAttachments = (nodes)=>filter((n)=>n.type !== "attachments", nodes);

var message = /*#__PURE__*/Object.freeze({
  __proto__: null,
  iterate: iterate,
  map: map,
  filter: filter,
  getMentions: getMentions,
  withoutAttachments: withoutAttachments
});

const parseChannel = (channel)=>({
        id: channel.id,
        name: channel.name,
        description: channel.description,
        avatar: channel.avatar,
        kind: channel.kind,
        createdAt: channel.created_at,
        memberUserIds: channel.members ?? [],
        ownerUserId: channel.owner
    });
const entriesById$2 = function() {
    let state = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {}, action = arguments.length > 1 ? arguments[1] : void 0;
    switch(action.type){
        case "fetch-client-boot-data-request-successful":
        case "fetch-user-channels-request-successful":
            {
                const parsedChannels = action.channels.map(parseChannel);
                const entriesById = indexBy((c)=>c.id, parsedChannels);
                return {
                    ...state,
                    ...entriesById
                };
            }
        case "fetch-channel-request-successful":
            {
                const existingChannelData = state[action.channel.id];
                return {
                    ...state,
                    [action.channel.id]: {
                        ...existingChannelData,
                        ...parseChannel(action.channel)
                    }
                };
            }
        case "fetch-channel-members-request-successful":
            {
                const existingChannelData1 = state[action.channelId];
                return {
                    ...state,
                    [action.channelId]: {
                        ...existingChannelData1,
                        id: action.channelId,
                        memberUserIds: action.members.map((m)=>m.id)
                    }
                };
            }
        case "delete-channel-request-successful":
            return omitKey(action.id, state);
        case "server-event:channel-updated":
            {
                const channelId = action.data.channel.id;
                return {
                    ...state,
                    [channelId]: {
                        ...state[channelId],
                        id: channelId,
                        ...parseChannel(action.data.channel)
                    }
                };
            }
        case "server-event:channel-user-invited":
            {
                const channelId1 = action.data.channel;
                return {
                    ...state,
                    [channelId1]: {
                        ...state[channelId1],
                        id: channelId1,
                        memberUserIds: [
                            action.data.user.id
                        ]
                    }
                };
            }
        case "logout":
            return {};
        default:
            return state;
    }
};
const metaById = function() {
    let state = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {}, action = arguments.length > 1 ? arguments[1] : void 0;
    switch(action.type){
        case "fetch-channel-public-permissions-request-successful":
            {
                const meta = state[action.channelId];
                return {
                    ...state,
                    [action.channelId]: {
                        ...meta,
                        publicPermissions: action.permissions
                    }
                };
            }
        case "messages-fetched":
            {
                const config = state[action.channelId];
                const hasAllMessages = action.messages.length < action.limit;
                return {
                    ...state,
                    [action.channelId]: {
                        ...config,
                        hasAllMessages,
                        hasFetchedMessages: true
                    }
                };
            }
        case "logout":
            return {};
        default:
            return state;
    }
};
const starsByChannelId = function() {
    let state = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : [], action = arguments.length > 1 ? arguments[1] : void 0;
    switch(action.type){
        case "fetch-starred-channels-request-successful":
            return indexBy((s)=>s.channelId, action.stars);
        case "star-channel-request-successful":
            return {
                ...state,
                [action.star.channelId]: action.star
            };
        case "unstar-channel-request-successful":
            return omitKey(action.channelId, state);
        case "logout":
            return [];
        default:
            return state;
    }
};
const readStatesById = function() {
    let state = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {}, action = arguments.length > 1 ? arguments[1] : void 0;
    switch(action.type){
        case "fetch-client-boot-data-request-successful":
        case "fetch-channels-read-states-request-successful":
            {
                const readStatesByChannelId = indexBy((s)=>s.channel, action.readStates);
                const mergedReadStates = action.channels.map((c)=>{
                    const existingState = {
                        channelId: c.id,
                        ...state[c.id]
                    };
                    const lastMessageAt = c.last_message_at;
                    const readStates = readStatesByChannelId[c.id];
                    if (readStates == null) return {
                        ...existingState,
                        lastMessageAt
                    };
                    return {
                        ...existingState,
                        lastMessageAt,
                        lastReadAt: readStates.last_read_at,
                        unreadMentionMessageIds: Array(readStates.mention_count).fill(null)
                    };
                });
                const entriesByChannelId = indexBy((s)=>s.channelId, mergedReadStates);
                return {
                    ...state,
                    ...entriesByChannelId
                };
            }
        // case "fetch-user-channels-request-successful": {
        //   const mergedReadStates = action.channels.map((c) => {
        //     const existingState = state[c.id];
        //     return {
        //       ...existingState,
        //       channelId: c.id,
        //       lastMessageAt: c.last_message_at,
        //     };
        //   });
        //   const entriesByChannelId = indexBy((s) => s.channelId, mergedReadStates);
        //   return { ...state, ...entriesByChannelId };
        // }
        case "mark-channel-read-request-sent":
            return {
                ...state,
                [action.channelId]: {
                    ...state[action.channelId],
                    lastReadAt: action.readAt.toISOString(),
                    unreadMentionMessageIds: []
                }
            };
        case "message-create-request-sent":
        case "message-create-request-successful":
            return {
                ...state,
                [action.message.channel]: {
                    ...state[action.message.channel],
                    lastReadAt: action.message.created_at,
                    lastMessageAt: action.message.created_at
                }
            };
        case "server-event:message-created":
            {
                const isOwnMessage = action.data.message.author === action.user.id;
                const channelState = state[action.data.message.channel];
                const userMentions = getMentions(action.data.message.blocks).filter((m)=>m.ref === action.user.id);
                const unreadMentionMessageIds = (channelState === null || channelState === void 0 ? void 0 : channelState.unreadMentionMessageIds) ?? [];
                return {
                    ...state,
                    [action.data.message.channel]: {
                        ...channelState,
                        lastMessageAt: action.data.message.created_at,
                        lastReadAt: isOwnMessage ? action.data.message.created_at : channelState === null || channelState === void 0 ? void 0 : channelState.lastReadAt,
                        unreadMentionMessageIds: userMentions.length === 0 ? unreadMentionMessageIds : [
                            ...unreadMentionMessageIds,
                            action.data.message.id
                        ]
                    }
                };
            }
        case "server-event:message-removed":
            {
                const channelState1 = state[action.data.message.channel];
                return {
                    ...state,
                    [action.data.message.channel]: {
                        ...channelState1,
                        unreadMentionMessageIds: channelState1.unreadMentionMessageIds.filter((id)=>id !== action.data.message.id)
                    }
                };
            }
        case "server-event:message-updated":
            {
                const channel = state[action.data.message.channel];
                const messageId = action.data.message.id;
                const userMentions1 = getMentions(action.data.message.blocks).filter((m)=>m.ref === action.user.id);
                return {
                    ...state,
                    [action.data.message.channel]: {
                        ...channel,
                        unreadMentionMessageIds: userMentions1.length === 0 ? channel.unreadMentionMessageIds.filter((id)=>id !== messageId) : unique([
                            ...channel.unreadMentionMessageIds,
                            messageId
                        ])
                    }
                };
            }
        case "logout":
            return {};
        default:
            return state;
    }
};
const selectChannel = createSelector((state, channelId)=>state.channels.entriesById[channelId], (state)=>state.me.user, (state, channelId)=>{
    const channel = state.channels.entriesById[channelId];
    if (channel == null || channel.kind !== "dm") return null;
    return channel.memberUserIds.map((userId)=>selectUser(state, userId));
}, (channel, loggedInUser, channelMemberUsers)=>{
    if (channel == null) return null;
    const buildName = ()=>{
        if (channel.kind !== "dm" || channel.name != null) return channel.name;
        if (channel.memberUserIds.length === 1) return "Me";
        return channelMemberUsers.filter((u)=>{
            return (u === null || u === void 0 ? void 0 : u.id) !== (loggedInUser === null || loggedInUser === void 0 ? void 0 : loggedInUser.id);
        }).map((u)=>{
            return u === null || u === void 0 ? void 0 : u.displayName;
        }).filter(Boolean).join(", ");
    };
    return {
        ...channel,
        name: buildName(),
        avatar: channel.avatar === "" ? null : channel.avatar,
        isAdmin: loggedInUser != null && loggedInUser.id === channel.ownerUserId
    };
}, {
    memoizeOptions: {
        maxSize: 1000
    }
});
const selectChannelMentionCount = createSelector((state, channelId)=>state.channels.readStatesById[channelId], (channelState)=>{
    if (channelState == null || channelState.unreadMentionMessageIds == null) return 0;
    return channelState.unreadMentionMessageIds.length;
}, {
    memoizeOptions: {
        maxSize: 1000
    }
});
const selectChannelHasUnread = createSelector((state, channelId)=>state.channels.readStatesById[channelId], (channelState /* channelKind, */  /* loggedInServerMember */ )=>{
    if (channelState == null) return false;
    const getLastReadTimestamp = ()=>{
        return channelState.lastReadAt == null ? new Date().getTime() : new Date(channelState.lastReadAt).getTime();
    // const channelJoinTimestamp =
    //   loggedInServerMember == null
    //     ? null
    //     : new Date(loggedInServerMember.joinedAt).getTime();
    // return channelState.lastReadAt == null
    //   ? null // channelJoinTimestamp
    //   : new Date(channelState.lastReadAt).getTime();
    };
    const lastReadTimestamp = getLastReadTimestamp();
    if (lastReadTimestamp == null) return false;
    const lastMessageTimestamp = new Date(channelState.lastMessageAt).getTime();
    return lastReadTimestamp < lastMessageTimestamp;
}, {
    memoizeOptions: {
        maxSize: 1000
    }
});
const selectDmChannelFromUserId = (state, userId)=>{
    const dmChannels = selectDmChannels(state);
    const userDmChannels = dmChannels.filter((c)=>c.memberUserIds.length <= 2 && c.memberUserIds.includes(userId));
    if (userDmChannels.length > 1) throw new Error();
    return userDmChannels[0];
};
const selectDmChannelFromUserIds = (state, userIds)=>{
    const dmChannels = selectDmChannels(state);
    return dmChannels.find((c)=>c.memberUserIds.length === userIds.length && c.memberUserIds.every((id)=>userIds.includes(id)));
};
const selectMemberChannels = createSelector((state)=>{
    if (state.me.user == null) return [];
    const channels = Object.entries(state.channels.entriesById).filter((entry)=>{
        var ref;
        return (ref = entry[1].memberUserIds) === null || ref === void 0 ? void 0 : ref.includes(state.me.user.id);
    }).map((param)=>{
        let [id] = param;
        return selectChannel(state, id);
    });
    return sort((c1, c2)=>{
        const [t1, t2] = [
            c1,
            c2
        ].map((c)=>{
            const readState = state.channels.readStatesById[c.id];
            return new Date((readState === null || readState === void 0 ? void 0 : readState.lastMessageAt) ?? c.createdAt).getTime();
        });
        return t1 > t2 ? -1 : t1 < t2 ? 1 : 0;
    }, channels);
}, (channels)=>channels, {
    memoizeOptions: {
        equalityCheck: arrayShallowEquals
    }
});
const selectDmChannels = createSelector((state)=>{
    const channels = Object.entries(state.channels.entriesById).filter((entry)=>entry[1].kind === "dm").map((param)=>{
        let [id] = param;
        return selectChannel(state, id);
    });
    return sort((c1, c2)=>{
        const [t1, t2] = [
            c1,
            c2
        ].map((c)=>{
            const readState = state.channels.readStatesById[c.id];
            return new Date((readState === null || readState === void 0 ? void 0 : readState.lastMessageAt) ?? c.createdAt).getTime();
        });
        return t1 > t2 ? -1 : t1 < t2 ? 1 : 0;
    }, channels);
}, (channels)=>channels, {
    memoizeOptions: {
        equalityCheck: arrayShallowEquals
    }
});
const selectStarredChannels = createSelector((state)=>Object.keys(state.channels.starsByChannelId).map((id)=>selectChannel(state, id)).filter(Boolean), (channels)=>channels, {
    memoizeOptions: {
        equalityCheck: arrayShallowEquals
    }
});
const selectIsChannelStarred = (state, id)=>selectChannelStarId(state, id) != null;
const selectTopicChannels = createSelector((state)=>{
    const channels = Object.values(state.channels.entriesById).filter((channel)=>channel.kind === "topic").map((c)=>selectChannel(state, c.id));
    return sort((c1, c2)=>{
        const [t1, t2] = [
            c1,
            c2
        ].map((c)=>{
            const readState = state.channels.readStatesById[c.id];
            return new Date((readState === null || readState === void 0 ? void 0 : readState.lastMessageAt) ?? c.createdAt).getTime();
        });
        return t1 > t2 ? -1 : t1 < t2 ? 1 : 0;
    }, channels);
}, (channels)=>channels, {
    memoizeOptions: {
        equalityCheck: arrayShallowEquals
    }
});
const selectDmAndTopicChannels = createSelector((state)=>{
    const channels = [
        ...selectDmChannels(state),
        ...selectTopicChannels(state)
    ];
    return sort((c1, c2)=>{
        const [t1, t2] = [
            c1,
            c2
        ].map((c)=>{
            const readState = state.channels.readStatesById[c.id];
            return new Date((readState === null || readState === void 0 ? void 0 : readState.lastMessageAt) ?? c.createdAt).getTime();
        });
        return t1 > t2 ? -1 : t1 < t2 ? 1 : 0;
    }, channels);
}, (channels)=>channels, {
    memoizeOptions: {
        equalityCheck: arrayShallowEquals
    }
});
const selectChannelMembers = createSelector((state, channelId)=>{
    const channel = state.channels.entriesById[channelId];
    if (channel == null) return [];
    return channel.memberUserIds.map((id)=>{
        const user = selectUser(state, id);
        return {
            ...user,
            id,
            isOwner: id === channel.ownerUserId
        };
    });
}, (members)=>members, {
    memoizeOptions: {
        equalityCheck: arrayShallowEquals
    }
});
const selectChannelStarId = (state, channelId)=>{
    var ref;
    return (ref = state.channels.starsByChannelId[channelId]) === null || ref === void 0 ? void 0 : ref.id;
};
const selectHasFetchedMessages = (state, channelId)=>{
    var ref;
    return ((ref = state.channels.metaById[channelId]) === null || ref === void 0 ? void 0 : ref.hasFetchedMessages) ?? false;
};
const selectHasAllMessages = (state, channelId)=>{
    var ref;
    return ((ref = state.channels.metaById[channelId]) === null || ref === void 0 ? void 0 : ref.hasAllMessages) ?? false;
};
const selectChannelAccessLevel = (state, channelId)=>{
    const meta = state.channels.metaById[channelId];
    if (meta == null || meta.publicPermissions == null) return "unknown";
    return meta.publicPermissions.includes("channels.join") ? "public" : "private";
};
var channels = combineReducers({
    entriesById: entriesById$2,
    metaById,
    readStatesById,
    starsByChannelId
});

const entriesById$1 = function() {
    let state = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {}, action = arguments.length > 1 ? arguments[1] : void 0;
    switch(action.type){
        case "fetch-client-boot-data-request-successful":
        case "fetch-apps-request-successful":
            {
                if (action.apps == null) return state;
                return indexBy((a)=>a.id, action.apps);
            }
        default:
            return state;
    }
};
const selectApp = (state, appId)=>state.apps.entriesById[appId];
var apps = combineReducers({
    entriesById: entriesById$1
});

const entriesById = function() {
    let state = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {}, action = arguments.length > 1 ? arguments[1] : void 0;
    switch(action.type){
        case "messages-fetched":
            return {
                ...state,
                ...indexBy((m)=>m.id, action.messages)
            };
        case "message-fetched":
            // Ignore messages already in cache to prevent rerenders. Updates should
            // be covered by server events anyway. Should be fine. Right? RIGHT?
            if (state[action.message.id] != null) return state;
            return {
                ...state,
                [action.message.id]: action.message
            };
        case "server-event:message-created":
            if (action.data.message.author === action.user.id) {
                const optimisticEntries = Object.values(state).filter((m)=>m.isOptimistic);
                if (optimisticEntries.length > 0) return state;
            }
            return {
                ...state,
                [action.data.message.id]: {
                    ...state[action.data.message.id],
                    ...action.data.message
                }
            };
        case "server-event:message-updated":
            return {
                ...state,
                [action.data.message.id]: {
                    ...state[action.data.message.id],
                    ...action.data.message
                }
            };
        case "server-event:message-removed":
            return omitKey(action.data.message.id, state);
        case "message-fetch-request-successful":
            return {
                ...state,
                [action.message.id]: action.message
            };
        case "message-delete-request-successful":
            return omitKey(action.messageId, state);
        case "message-create-request-sent":
            return {
                ...state,
                [action.message.id]: {
                    ...action.message,
                    isOptimistic: true
                }
            };
        case "message-create-request-successful":
            return {
                // Remove the optimistic entry
                ...omitKey(action.optimisticEntryId, state),
                [action.message.id]: action.message
            };
        case "message-create-request-failed":
            // Remove the optimistic entry
            return omitKey(action.optimisticEntryId, state);
        case "message-update-request-successful":
            return {
                ...state,
                [action.message.id]: action.message
            };
        case "add-message-reaction:request-sent":
            {
                const message = state[action.messageId];
                const existingReaction = message.reactions.find((r)=>r.emoji === action.emoji);
                return {
                    ...state,
                    [action.messageId]: {
                        ...message,
                        reactions: existingReaction == null ? [
                            ...message.reactions,
                            {
                                emoji: action.emoji,
                                count: 1,
                                users: [
                                    action.userId
                                ]
                            }
                        ] : message.reactions.map((r)=>r.emoji === action.emoji ? {
                                ...r,
                                count: r.count + 1,
                                users: [
                                    ...r.users,
                                    action.userId
                                ]
                            } : r)
                    }
                };
            }
        case "remove-message-reaction:request-sent":
            {
                const message1 = state[action.messageId];
                const reaction = message1.reactions.find((r)=>r.emoji === action.emoji);
                return {
                    ...state,
                    [action.messageId]: {
                        ...message1,
                        reactions: reaction.count === 1 ? message1.reactions.filter((r)=>r.emoji !== action.emoji) : message1.reactions.map((r)=>r.emoji === action.emoji ? {
                                ...r,
                                count: r.count - 1,
                                users: r.users.filter((userId)=>userId !== action.userId)
                            } : r)
                    }
                };
            }
        // TODO: Update the reactions individually to prevent race conditions
        case "server-event:message-reaction-added":
        case "server-event:message-reaction-removed":
            return {
                ...state,
                [action.data.message.id]: action.data.message
            };
        case "logout":
            return {};
        default:
            return state;
    }
};
const entryIdsByChannelId = function() {
    let state = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {}, action = arguments.length > 1 ? arguments[1] : void 0;
    switch(action.type){
        case "messages-fetched":
            {
                const messageIdsByChannelId = mapValues((ms, channelId)=>{
                    const previousIds = state[channelId] ?? [];
                    const newIds = ms.map((m)=>m.id);
                    return unique([
                        ...previousIds,
                        ...newIds
                    ]);
                }, groupBy((m)=>m.channel, action.messages));
                return {
                    ...state,
                    ...messageIdsByChannelId
                };
            }
        case "message-fetched":
            {
                const channelId = action.message.channel;
                const channelMessageIds = state[channelId] ?? [];
                return {
                    ...state,
                    [channelId]: unique([
                        ...channelMessageIds,
                        action.message
                    ])
                };
            }
        case "server-event:message-created":
            {
                const channelId1 = action.data.message.channel;
                const channelMessageIds1 = state[channelId1] ?? [];
                return {
                    ...state,
                    [channelId1]: unique([
                        ...channelMessageIds1,
                        action.data.message.id
                    ])
                };
            }
        case "message-create-request-sent":
            {
                const channelId2 = action.message.channel;
                const channelMessageIds2 = state[channelId2] ?? [];
                return {
                    ...state,
                    [channelId2]: unique([
                        ...channelMessageIds2,
                        action.message.id
                    ])
                };
            }
        case "message-create-request-successful":
            {
                const channelId3 = action.message.channel;
                const channelMessageIds3 = state[channelId3] ?? [];
                return {
                    ...state,
                    [channelId3]: unique([
                        // Remove the optimistic entry
                        ...channelMessageIds3.filter((id)=>id !== action.optimisticEntryId),
                        action.message.id
                    ])
                };
            }
        case "message-create-request-failed":
            {
                const channelId4 = action.channelId;
                const channelMessageIds4 = state[channelId4] ?? [];
                return {
                    ...state,
                    // Remove the optimistic entry
                    [channelId4]: channelMessageIds4.filter((id)=>id !== action.optimisticEntryId)
                };
            }
        case "server-event:message-removed":
            return mapValues((messageIds)=>messageIds.filter((id)=>id !== action.data.message.id), state);
        case "message-delete-request-successful":
            return mapValues((messageIds)=>messageIds.filter((id)=>id !== action.messageId), state);
        case "logout":
            return {};
        default:
            return state;
    }
};
const systemMessageTypes = [
    "member-joined",
    "user-invited",
    "channel-updated"
];
const appMessageTypes = [
    "webhook",
    "app",
    "app-installed"
];
const deriveMessageType = (message)=>{
    switch(message.type){
        case undefined:
        case 0:
            return "regular";
        case 1:
            if (message.inviter) return "user-invited";
            return "member-joined";
        case 2:
        case 3:
            return "webhook";
        case 5:
            return "channel-updated";
        case 6:
            return "app-installed";
        default:
            console.warn(`Unknown message type "${message.type}"`);
    }
};
const selectMessage = createSelector((state, messageId)=>state.messages.entriesById[messageId], (state, messageId)=>{
    const message = state.messages.entriesById[messageId];
    if (message == null) return null;
    return selectUser(state, message.author);
}, (state, messageId)=>{
    const message = state.messages.entriesById[messageId];
    if (message == null || message.inviter == null) return null;
    return selectUser(state, message.inviter);
}, (state, messageId)=>{
    const message = state.messages.entriesById[messageId];
    if (message == null || message.installer == null) return null;
    return selectUser(state, message.installer);
}, (state, messageId)=>{
    const message = state.messages.entriesById[messageId];
    if (message == null || message.reply_to == null) return null;
    return selectMessage(state, message.reply_to);
}, (state)=>state.me.user, (state, messageId)=>{
    const message = state.messages.entriesById[messageId];
    if (message == null || !message.app) return null;
    return selectApp(state, message.app);
}, (message, author, inviter, installer, repliedMessage, loggedInUser, app)=>{
    var ref, ref1;
    if (message == null) return null;
    if (message.deleted) return message;
    const type = deriveMessageType(message);
    if (type == null) return null;
    const isSystemMessage = systemMessageTypes.includes(type);
    const isAppMessage = appMessageTypes.includes(type);
    const serverId = message.server;
    const appId = message.app;
    const authorUserId = message.author;
    const inviterUserId = message.inviter;
    const installerUserId = message.installer;
    const authorId = isSystemMessage ? "system" : isAppMessage ? appId : authorUserId;
    if (message.reply_to != null) {
        message.repliedMessage = repliedMessage;
        message.isReply = true;
    }
    return {
        ...message,
        createdAt: message.created_at,
        serverId,
        channelId: message.channel,
        authorUserId,
        authorId,
        isEdited: message.edited_at != null,
        type,
        isSystemMessage,
        isAppMessage,
        isOptimistic: message.isOptimistic,
        author,
        inviterUserId,
        inviter,
        installerUserId,
        installer,
        content: ((ref = message.blocks) === null || ref === void 0 ? void 0 : ref.length) > 0 ? message.blocks : [
            {
                type: "paragraph",
                children: [
                    {
                        text: message.content
                    }
                ]
            }
        ],
        stringContent: message.content,
        reactions: ((ref1 = message.reactions) === null || ref1 === void 0 ? void 0 : ref1.map((r)=>{
            return {
                ...r,
                hasReacted: r.users.includes(loggedInUser === null || loggedInUser === void 0 ? void 0 : loggedInUser.id)
            };
        })) ?? [],
        appId,
        app
    };
}, {
    memoizeOptions: {
        maxSize: 1000
    }
});
const selectChannelMessages = createSelector((state, channelId)=>{
    const channelMessageIds = state.messages.entryIdsByChannelId[channelId] ?? [];
    return channelMessageIds.map((messageId)=>selectMessage(state, messageId)).filter((m)=>m != null && !m.deleted);
}, (messages)=>messages, {
    memoizeOptions: {
        equalityCheck: arrayShallowEquals
    }
});
var messages = combineReducers({
    entriesById,
    entryIdsByChannelId
});

const typingUserIdsByChannelId = function() {
    let state = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {}, action = arguments.length > 1 ? arguments[1] : void 0;
    switch(action.type){
        case "server-event:user-typed":
            {
                const channelId = action.data.channel.id;
                const channelTypingUserIds = state[channelId] ?? [];
                return {
                    ...state,
                    [channelId]: unique([
                        ...channelTypingUserIds,
                        action.data.user.id
                    ])
                };
            }
        case "server-event:message-created":
            {
                var ref;
                const channelId1 = action.data.message.channel;
                const authorUserId = action.data.message.author;
                return {
                    ...state,
                    [channelId1]: ((ref = state[channelId1]) === null || ref === void 0 ? void 0 : ref.filter((id)=>id !== authorUserId)) ?? []
                };
            }
        case "user-typing-ended":
            var ref1;
            return {
                ...state,
                [action.channelId]: ((ref1 = state[action.channelId]) === null || ref1 === void 0 ? void 0 : ref1.filter((id)=>id !== action.userId)) ?? []
            };
        case "logout":
            return {};
        default:
            return state;
    }
};
const selectChannelTypingMembers = createSelector((state, channelId)=>{
    const channel = state.channels.entriesById[channelId];
    if (channel == null) return [];
    const userIds = state.channelTypingStatus.typingUserIdsByChannelId[channelId] ?? [];
    const members = selectUsers(state, userIds);
    return members.filter((m)=>state.me.user == null || m.id !== state.me.user.id);
}, (members)=>members, {
    memoizeOptions: {
        equalityCheck: arrayShallowEquals
    }
});
var channelTypingStatus = combineReducers({
    typingUserIdsByChannelId
});

const selectors = {
    selectMe,
    selectChannel,
    selectChannelMembers,
    selectChannelAccessLevel,
    selectMemberChannels,
    selectDmChannels,
    selectTopicChannels,
    selectDmAndTopicChannels,
    selectStarredChannels,
    selectMessage,
    selectChannelMessages,
    selectUser,
    selectUserFromWalletAddress,
    selectDmChannelFromUserId,
    selectDmChannelFromUserIds,
    selectHasFetchedInitialData,
    selectChannelTypingMembers,
    selectHasAllMessages,
    selectHasFetchedMessages,
    selectChannelHasUnread,
    selectChannelMentionCount,
    selectChannelStarId,
    selectIsChannelStarred,
    selectApp,
    selectHasFetchedMenuData
};
const rootReducer = combineReducers({
    me,
    channels,
    users,
    messages,
    channelTypingStatus,
    apps,
    ui: reducer
});
const initialState = rootReducer(undefined, {});
const applyStateToSelectors = (selectors, state)=>mapValues((selector)=>selector.bind(null, state), selectors);
const useRootReducer = ()=>{
    const [state, dispatch_] = React.useReducer(rootReducer, initialState);
    const beforeDispatchListenersRef = React.useRef([]);
    const afterDispatchListenersRef = React.useRef([]);
    const addBeforeDispatchListener = React.useCallback((fn)=>{
        beforeDispatchListenersRef.current.push(fn);
        return ()=>{
            beforeDispatchListenersRef.current.filter((fn_)=>fn_ !== fn);
        };
    }, []);
    const addAfterDispatchListener = React.useCallback((fn)=>{
        afterDispatchListenersRef.current.push(fn);
        return ()=>{
            afterDispatchListenersRef.current.filter((fn_)=>fn_ !== fn);
        };
    }, []);
    const dispatch = React.useCallback((action)=>{
        for (let callback of beforeDispatchListenersRef.current)callback(action);
        const result = dispatch_(action);
        for (let callback1 of afterDispatchListenersRef.current)callback1(action);
        return result;
    }, []);
    const appliedSelectors = React.useMemo(()=>applyStateToSelectors(selectors, state), [
        state
    ]);
    return [
        appliedSelectors,
        dispatch,
        {
            addBeforeDispatchListener,
            addAfterDispatchListener
        }
    ];
};

const Context$1 = /*#__PURE__*/ React.createContext({});
const useAppScope = ()=>React.useContext(Context$1);
const Provider$1 = (param)=>{
    let { children  } = param;
    const { authorizedFetch , logout: clearAuthTokens  } = useAuth();
    const [stateSelectors, dispatch, { addBeforeDispatchListener , addAfterDispatchListener  }, ] = useRootReducer();
    const user = stateSelectors.selectMe();
    const logout = useLatestCallback(()=>{
        clearAuthTokens();
        dispatch({
            type: "logout"
        });
    });
    const fetchMe = useLatestCallback(()=>authorizedFetch("/users/me").then((user)=>{
            dispatch({
                type: "fetch-me-request-successful",
                user
            });
            return user;
        }));
    const updateMe = useLatestCallback((param)=>{
        let { displayName , pfp  } = param;
        return authorizedFetch("/users/me", {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                display_name: displayName,
                pfp
            })
        });
    });
    const fetchUsers = useLatestCallback((userIds)=>authorizedFetch("/users/info", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                user_ids: userIds
            })
        }).then((users)=>{
            dispatch({
                type: "fetch-users-request-successful",
                users
            });
            return users;
        }));
    const fetchMessages = useLatestCallback(function(channelId) {
        let { limit =50 , beforeMessageId , afterMessageId  } = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
        if (limit == null) throw new Error(`Missing required "limit" argument`);
        const searchParams = new URLSearchParams([
            [
                "before",
                beforeMessageId
            ],
            [
                "after",
                afterMessageId
            ],
            [
                "limit",
                limit
            ]
        ].filter((e)=>e[1] != null));
        const url = [
            `/channels/${channelId}/messages`,
            searchParams.toString()
        ].filter((s)=>s !== "").join("?");
        return authorizedFetch(url, {
            allowUnauthorized: true
        }).then((messages)=>{
            dispatch({
                type: "messages-fetched",
                channelId,
                limit,
                beforeMessageId,
                afterMessageId,
                messages
            });
            const replies = messages.filter((m)=>m.reply_to != null);
            // Fetch all messages replied to async. Works for now!
            for (let reply of replies)authorizedFetch(`/channels/${channelId}/messages/${reply.reply_to}`).then((message)=>{
                dispatch({
                    type: "message-fetched",
                    message: message ?? {
                        id: reply.reply_to,
                        channel: channelId,
                        deleted: true
                    }
                });
            });
            return messages;
        });
    });
    const markChannelRead = useLatestCallback((channelId, param)=>{
        let { readAt  } = param;
        // TODO: Undo if request fails
        dispatch({
            type: "mark-channel-read-request-sent",
            channelId,
            readAt
        });
        return authorizedFetch(`/channels/${channelId}/ack`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                last_read_at: readAt.toISOString()
            })
        });
    });
    const fetchMessage = useLatestCallback((id)=>authorizedFetch(`/messages/${id}`).then((message)=>{
            dispatch({
                type: "message-fetch-request-successful",
                message
            });
            return message;
        }));
    const createMessage = useLatestCallback(async (param)=>{
        let { channel , content , blocks , replyToMessageId  } = param;
        // TODO: Less hacky optimistc UI
        const message = {
            channel,
            blocks,
            content,
            reply_to: replyToMessageId
        };
        const dummyId = generateDummyId();
        dispatch({
            type: "message-create-request-sent",
            message: {
                ...message,
                id: dummyId,
                created_at: new Date().toISOString(),
                author: user.id
            }
        });
        return authorizedFetch("/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(message)
        }).then((message)=>{
            dispatch({
                type: "message-create-request-successful",
                message,
                optimisticEntryId: dummyId
            });
            markChannelRead(message.channel, {
                readAt: new Date(message.created_at)
            });
            return message;
        }, (error)=>{
            dispatch({
                type: "message-create-request-failed",
                error,
                channelId: channel,
                optimisticEntryId: dummyId
            });
            return Promise.reject(error);
        });
    });
    const updateMessage = useLatestCallback(async (messageId, param)=>{
        let { blocks , content  } = param;
        return authorizedFetch(`/messages/${messageId}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                blocks,
                content
            })
        }).then((message)=>{
            dispatch({
                type: "message-update-request-successful",
                message
            });
            return message;
        });
    });
    const removeMessage = useLatestCallback(async (messageId)=>{
        return authorizedFetch(`/messages/${messageId}`, {
            method: "DELETE"
        }).then((message)=>{
            dispatch({
                type: "message-delete-request-successful",
                messageId
            });
            return message;
        });
    });
    const addMessageReaction = useLatestCallback(async (messageId, param)=>{
        let { emoji  } = param;
        invariant(// https://stackoverflow.com/questions/18862256/how-to-detect-emoji-using-javascript#answer-64007175
        /\p{Emoji}/u.test(emoji), "Only emojis allowed");
        dispatch({
            type: "add-message-reaction:request-sent",
            messageId,
            emoji,
            userId: user.id
        });
        // TODO: Undo the optimistic update if the request fails
        return authorizedFetch(`/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`, {
            method: "POST"
        });
    });
    const removeMessageReaction = useLatestCallback(async (messageId, param)=>{
        let { emoji  } = param;
        dispatch({
            type: "remove-message-reaction:request-sent",
            messageId,
            emoji,
            userId: user.id
        });
        // TODO: Undo the optimistic update if the request fails
        return authorizedFetch(`/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`, {
            method: "DELETE"
        });
    });
    const fetchChannel = useLatestCallback((id)=>authorizedFetch(`/channels/${id}`, {
            allowUnauthorized: true
        }).then((res)=>{
            dispatch({
                type: "fetch-channel-request-successful",
                channel: res
            });
            return res;
        }));
    const fetchUserChannels = useLatestCallback(()=>authorizedFetch("/users/me/channels").then((channels)=>{
            dispatch({
                type: "fetch-user-channels-request-successful",
                channels
            });
            return channels;
        }));
    const fetchUserChannelsReadStates = useLatestCallback(()=>authorizedFetch("/users/me/read_states").then((readStates)=>{
            dispatch({
                type: "fetch-user-channels-read-states-request-successful",
                readStates
            });
            return readStates;
        }));
    const createChannel = useLatestCallback((param)=>{
        let { name , description  } = param;
        return authorizedFetch("/channels", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                kind: "topic",
                name,
                description
            })
        }).then((res)=>{
            // TODO
            fetchUserChannels();
            // fetchInitialData();
            return res;
        });
    });
    const createDmChannel = useLatestCallback((param)=>{
        let { name , memberUserIds , memberWalletAddresses  } = param;
        return authorizedFetch("/channels", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                name,
                kind: "dm",
                members: memberWalletAddresses ?? memberUserIds
            })
        }).then((res)=>{
            // TODO
            fetchUserChannels();
            // fetchInitialData();
            return res;
        });
    });
    const fetchChannelMembers = useLatestCallback((id)=>authorizedFetch(`/channels/${id}/members`, {
            allowUnauthorized: true
        }).then((res)=>{
            dispatch({
                type: "fetch-channel-members-request-successful",
                channelId: id,
                members: res
            });
            return res;
        }));
    const fetchChannelPublicPermissions = useLatestCallback((id)=>authorizedFetch(`/channels/${id}/permissions`, {
            unauthorized: true,
            priority: "low"
        }).then((res)=>{
            dispatch({
                type: "fetch-channel-public-permissions-request-successful",
                channelId: id,
                permissions: res
            });
            return res;
        }));
    const addChannelMember = useLatestCallback((channelId, walletAddressOrUserId)=>authorizedFetch(`/channels/${channelId}/invite`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                members: Array.isArray(walletAddressOrUserId) ? walletAddressOrUserId : [
                    walletAddressOrUserId
                ]
            })
        }).then((res)=>{
            // TODO
            fetchChannelMembers(channelId);
            // fetchInitialData();
            return res;
        }));
    const removeChannelMember = useLatestCallback((channelId, userId)=>authorizedFetch(`/channels/${channelId}/members/${userId}`, {
            method: "DELETE"
        }).then((res)=>{
            // TODO
            fetchChannelMembers(channelId);
            // fetchInitialData();
            return res;
        }));
    const joinChannel = useLatestCallback((channelId)=>authorizedFetch(`/channels/${channelId}/join`, {
            method: "POST"
        }).then((res)=>{
            // TODO
            fetchChannelMembers(channelId);
            // fetchInitialData();
            return res;
        }));
    const leaveChannel = useLatestCallback((channelId)=>authorizedFetch(`/channels/${channelId}/members/me`, {
            method: "DELETE"
        }).then((res)=>{
            // TODO
            fetchChannelMembers(channelId);
            // fetchInitialData();
            return res;
        }));
    const updateChannel = useLatestCallback((id, param)=>{
        let { name , description , avatar  } = param;
        return authorizedFetch(`/channels/${id}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                name,
                description,
                avatar
            })
        }).then((res)=>{
            // TODO
            fetchChannel(id);
            // fetchInitialData();
            return res;
        });
    });
    const deleteChannel = useLatestCallback((id)=>authorizedFetch(`/channels/${id}`, {
            method: "DELETE"
        }).then((res)=>{
            dispatch({
                type: "delete-channel-request-successful",
                id
            });
            return res;
        }));
    const makeChannelPublic = useLatestCallback((channelId)=>authorizedFetch(`/channels/${channelId}/permissions`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify([
                {
                    group: "@public",
                    permissions: [
                        "channels.join",
                        "channels.view",
                        "channels.members.list",
                        "messages.list"
                    ]
                }
            ])
        }).then((res)=>{
            // TODO permissions?
            fetchChannelPublicPermissions(channelId);
            // fetchInitialData();
            return res;
        }));
    const makeChannelPrivate = useLatestCallback((channelId)=>authorizedFetch(`/channels/${channelId}/permissions`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify([
                {
                    group: "@public",
                    permissions: []
                }
            ])
        }).then((res)=>{
            // TODO permissions?
            fetchChannelPublicPermissions(channelId);
            // fetchInitialData();
            return res;
        }));
    const fetchStarredItems = useLatestCallback(()=>authorizedFetch("/stars", {
            priority: "low"
        }).then((res)=>{
            dispatch({
                type: "fetch-starred-channels-request-successful",
                stars: res.map((s)=>({
                        id: s.id,
                        channelId: s.channel
                    }))
            });
            return res;
        }));
    const fetchApps = useLatestCallback(()=>authorizedFetch("/apps", {
            allowUnauthorized: true,
            priority: "low"
        }).then((res)=>{
            dispatch({
                type: "fetch-apps-request-successful",
                apps: res
            });
            return res;
        }));
    const fetchClientBootData = useLatestCallback(async ()=>{
        const [{ user , channels , read_states: readStates , apps  }, starredItems] = await Promise.all([
            authorizedFetch("/ready"),
            fetchStarredItems()
        ]);
        dispatch({
            type: "fetch-client-boot-data-request-successful",
            user,
            channels,
            readStates,
            apps
        });
        return {
            user,
            channels,
            readStates,
            starredItems
        };
    });
    const starChannel = useLatestCallback((channelId)=>authorizedFetch("/stars", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                channel: channelId
            })
        }).then((res)=>{
            dispatch({
                type: "star-channel-request-successful",
                star: {
                    id: res.id,
                    channelId
                }
            });
            return res;
        }));
    const unstarChannel = useLatestCallback((channelId)=>{
        const starId = stateSelectors.selectChannelStarId(channelId);
        return authorizedFetch(`/stars/${starId}`, {
            method: "DELETE"
        }).then((res)=>{
            dispatch({
                type: "unstar-channel-request-successful",
                channelId
            });
            return res;
        });
    });
    const uploadImage = useLatestCallback((param)=>{
        let { files  } = param;
        const formData = new FormData();
        for (let file of files)formData.append("files", file);
        return authorizedFetch("/media/images", {
            method: "POST",
            body: formData
        });
    });
    const registerChannelTypingActivity = useLatestCallback((channelId)=>authorizedFetch(`/channels/${channelId}/typing`, {
            method: "POST"
        }));
    const searchGifs = useLatestCallback((query)=>authorizedFetch(`/integrations/tenor/search?q=${query}`));
    const actions = React.useMemo(()=>({
            logout,
            fetchMe,
            fetchClientBootData,
            fetchMessage,
            updateMe,
            fetchUsers,
            fetchMessages,
            fetchUserChannels,
            fetchUserChannelsReadStates,
            fetchChannel,
            createChannel,
            createDmChannel,
            fetchChannelMembers,
            fetchChannelPublicPermissions,
            addChannelMember,
            removeChannelMember,
            joinChannel,
            leaveChannel,
            updateChannel,
            deleteChannel,
            makeChannelPublic,
            makeChannelPrivate,
            createMessage,
            updateMessage,
            removeMessage,
            addMessageReaction,
            removeMessageReaction,
            markChannelRead,
            fetchStarredItems,
            starChannel,
            unstarChannel,
            fetchApps,
            uploadImage,
            registerChannelTypingActivity,
            searchGifs
        }), [
        logout,
        fetchMe,
        fetchClientBootData,
        fetchMessage,
        updateMe,
        fetchUsers,
        fetchMessages,
        fetchUserChannels,
        fetchUserChannelsReadStates,
        fetchChannel,
        createChannel,
        makeChannelPublic,
        makeChannelPrivate,
        createDmChannel,
        fetchChannelMembers,
        fetchChannelPublicPermissions,
        addChannelMember,
        removeChannelMember,
        joinChannel,
        leaveChannel,
        updateChannel,
        deleteChannel,
        createMessage,
        updateMessage,
        removeMessage,
        addMessageReaction,
        removeMessageReaction,
        markChannelRead,
        fetchStarredItems,
        starChannel,
        unstarChannel,
        fetchApps,
        uploadImage,
        registerChannelTypingActivity,
        searchGifs
    ]);
    const contextValue = React.useMemo(()=>({
            dispatch,
            state: stateSelectors,
            actions,
            addBeforeDispatchListener,
            addAfterDispatchListener
        }), [
        dispatch,
        stateSelectors,
        actions,
        addBeforeDispatchListener,
        addAfterDispatchListener
    ]);
    return /*#__PURE__*/ React.createElement(Context$1.Provider, {
        value: contextValue
    }, children);
};

const serverEventMap = {
    MESSAGE_CREATE: "message-created",
    MESSAGE_UPDATE: "message-updated",
    MESSAGE_REMOVE: "message-removed",
    MESSAGE_REACTION_ADD: "message-reaction-added",
    MESSAGE_REACTION_REMOVE: "message-reaction-removed",
    USER_PROFILE_UPDATE: "user-profile-updated",
    USER_PRESENCE_UPDATE: "user-presence-updated",
    USER_TYPING: "user-typed",
    CHANNEL_UPDATE: "channel-updated",
    CHANNEL_USER_JOINED: "channel-user-joined",
    CHANNEL_USER_INVITED: "channel-user-invited"
};
const initPusherConnection = (param)=>{
    let { Pusher , key , accessToken , apiOrigin  } = param;
    const pusher = new Pusher(key, {
        cluster: "eu",
        authEndpoint: `${apiOrigin}/websockets/auth`,
        auth: {
            params: {
                provider: "pusher"
            },
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        }
    });
    return new Promise((resolve)=>{
        pusher.connection.bind("connected", ()=>{
            resolve(pusher);
        });
    });
};
const Context = /*#__PURE__*/ React.createContext(null);
const Provider = (param)=>{
    let { Pusher , pusherKey , debug =false , children  } = param;
    const { state  } = useAppScope();
    const { accessToken , apiOrigin  } = useAuth();
    const user = state.selectMe();
    const pusherRef = React.useRef();
    const channelRef = React.useRef();
    const listenersRef = React.useRef([]);
    const [pusherState, setPusherState] = React.useState(null);
    const addListener = React.useCallback((fn)=>{
        listenersRef.current = [
            ...listenersRef.current,
            fn
        ];
        return ()=>{
            listenersRef.current = listenersRef.current.filter((fn_)=>fn !== fn_);
        };
    }, []);
    React.useEffect(()=>{
        if (accessToken == null || (user === null || user === void 0 ? void 0 : user.id) == null) return;
        Pusher.logToConsole = debug;
        const connect = async ()=>{
            const pusher = await initPusherConnection({
                Pusher,
                key: pusherKey,
                accessToken,
                apiOrigin
            });
            if (pusherRef.current != null) {
                pusherRef.current.connection.unbind("state_change");
                pusherRef.current.disconnect();
            }
            pusherRef.current = pusher;
            channelRef.current = pusher.subscribe(`private-${user.id}`);
            for (let event of Object.keys(serverEventMap))channelRef.current.bind(event, (data)=>{
                const clientEventName = serverEventMap[event];
                listenersRef.current.forEach((fn)=>fn(clientEventName, data));
            });
            pusher.connection.bind("state_change", (param)=>{
                let { current  } = param;
                setPusherState(current);
            });
            setPusherState(pusher.connection.state);
        };
        connect();
    }, [
        Pusher,
        apiOrigin,
        pusherKey,
        debug,
        user === null || user === void 0 ? void 0 : user.id,
        accessToken
    ]);
    const serverConnection = React.useMemo(()=>({
            addListener,
            isConnected: pusherState === "connected"
        }), [
        addListener,
        pusherState
    ]);
    return /*#__PURE__*/ React.createElement(Context.Provider, {
        value: serverConnection
    }, children);
};
const useServerConnection = ()=>React.useContext(Context);

const identity = (_)=>_;
const compose = function() {
    for(var _len = arguments.length, fns = new Array(_len), _key = 0; _key < _len; _key++){
        fns[_key] = arguments[_key];
    }
    return function(x) {
        for(var _len = arguments.length, rest = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++){
            rest[_key - 1] = arguments[_key];
        }
        return fns.reduceRight((v, f)=>f(v, ...rest), x);
    };
};

var _function = /*#__PURE__*/Object.freeze({
  __proto__: null,
  identity: identity,
  compose: compose
});

export { Provider$1 as AppScopeProvider, Provider$2 as AuthProvider, Provider as ServerConnectionProvider, array as arrayUtils, _function as functionUtils, getImageDimensionsFromUrl, getImageFileDimensions, invariant, isTouchDevice, message as messageUtils, object as objectUtils, useAppScope, useAuth, useLatestCallback, useServerConnection };
