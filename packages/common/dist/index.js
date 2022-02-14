import React from 'react';
import { inflate } from 'pako';

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
const createAsyncWebStorage = function() {
    let storage = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : window.localStorage;
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
    const [token1, setToken] = React.useState(undefined);
    React.useEffect(()=>{
        storageRef.current = storage;
    });
    const set = React.useCallback((token)=>{
        setToken(token);
        storageRef.current.setItem(ACCESS_TOKEN_CACHE_KEY, token);
    }, []);
    const clear = React.useCallback(()=>{
        setToken(null);
        storageRef.current.removeItem(ACCESS_TOKEN_CACHE_KEY);
    }, []);
    React.useEffect(()=>{
        storageRef.current.getItem(ACCESS_TOKEN_CACHE_KEY).then((maybeToken)=>{
            setToken(maybeToken ?? null);
        });
    }, []);
    return [
        token1,
        {
            set,
            clear
        }
    ];
};
const Context$2 = /*#__PURE__*/ React.createContext({});
const useAuth = ()=>React.useContext(Context$2)
;
const Provider$2 = (param1)=>{
    let { apiOrigin , tokenStorage =asyncWebStorage , ...props } = param1;
    const [accessToken, { set: setAccessToken , clear: clearAccessToken  }] = useAccessToken({
        storage: tokenStorage
    });
    const [user1, setUser] = React.useState(null);
    const status = accessToken === undefined ? "loading" : accessToken == null ? "not-authenticated" : "authenticated";
    const signIn = React.useCallback(async (param)=>{
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
    }, [
        apiOrigin,
        setAccessToken
    ]);
    const authorizedFetch = React.useCallback(async (url, options)=>{
        if (accessToken == null) throw new Error("Missing access token");
        const headers = new Headers(options === null || options === void 0 ? void 0 : options.headers);
        headers.append("Authorization", `Bearer ${accessToken}`);
        const response = await fetch(`${apiOrigin}${url}`, {
            ...options,
            headers
        });
        if (response.status === 401) clearAccessToken();
        if (response.ok) return response.json();
        return Promise.reject(new Error(response.statusText));
    }, [
        apiOrigin,
        accessToken,
        clearAccessToken
    ]);
    const verifyAccessToken = React.useCallback(()=>{
        // This will have to do for now
        return authorizedFetch("/users/me").then(()=>null
        );
    }, [
        authorizedFetch
    ]);
    const contextValue = React.useMemo(()=>({
            status,
            accessToken,
            user: user1,
            apiOrigin,
            authorizedFetch,
            signIn,
            setAccessToken,
            verifyAccessToken
        })
    , [
        status,
        accessToken,
        user1,
        apiOrigin,
        authorizedFetch,
        signIn,
        setAccessToken,
        verifyAccessToken, 
    ]);
    React.useEffect(()=>{
        if (status !== "authenticated") return;
        authorizedFetch("/users/me").then((user)=>{
            setUser(user);
        });
    }, [
        authorizedFetch,
        status
    ]);
    return(/*#__PURE__*/ React.createElement(Context$2.Provider, _extends({
        value: contextValue
    }, props)));
};

const identity = (_)=>_
;

let prevDummyId = 0;
const generateDummyId = ()=>{
    const id = prevDummyId++;
    prevDummyId = id;
    return id;
};
const zlibDecompressData = (data)=>{
    var bufferData = Buffer.from(data, "base64");
    var binData = new Uint8Array(bufferData);
    return JSON.parse(inflate(binData, {
        to: "string"
    }));
};
const decompressData = function(data) {
    let compressionAlgorithm = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : "zlib";
    if (!compressionAlgorithm || compressionAlgorithm === "zlib") return zlibDecompressData(data);
    else throw `unknown compression algorithm: ${compressionAlgorithm}`;
};

const clientEventMap = {
    "request-user-data": [
        "client-connection-request"
    ],
    "mark-channel-read": [
        "client-channel-mark",
        (clientPayload)=>({
                channel_id: clientPayload.channelId,
                last_read_at: clientPayload.date.toISOString()
            })
        , 
    ]
};
const serverEventMap = {
    CONNECTION_READY: "user-data",
    MESSAGE_CREATE: "message-created"
};
const Context$1 = /*#__PURE__*/ React.createContext(null);
const Provider$1 = (param)=>{
    let { Pusher , pusherKey , debug =false , children  } = param;
    const { accessToken , user , apiOrigin  } = useAuth();
    const channelRef = React.useRef();
    const listenersRef = React.useRef([]);
    const send = React.useCallback(function(event) {
        let payload = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {
            no: "data"
        };
        const [serverEvent, payloadMapper = identity] = clientEventMap[event];
        if (serverEvent == null) throw new Error(`Unknown event "${event}"`);
        // Pusher returns true if the message is successfully sent, false otherwise
        return channelRef.current.trigger(serverEvent, payloadMapper(payload));
    }, []);
    const addListener = React.useCallback((fn)=>{
        listenersRef.current = [
            ...listenersRef.current,
            fn
        ];
        return ()=>{
            listenersRef.current = listenersRef.current.filter((fn_)=>fn !== fn_
            );
        };
    }, []);
    React.useEffect(()=>{
        if (accessToken == null || user == null) return;
        Pusher.logToConsole = debug;
        const pusher = new Pusher(pusherKey, {
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
        const channel = pusher.subscribe(`private-${user.id}`);
        channelRef.current = channel;
        channel.bind("pusher:subscription_succeeded", ()=>{
            channel.trigger("client-connection-request", {
                no: "data"
            });
        });
        const serverEvents = Object.keys(serverEventMap);
        for (let event of serverEvents)channel.bind(event, (data)=>{
            const clientEventName = serverEventMap[event];
            if (data.compressed) {
                let compressedData = data.compressed.data;
                let compressionAlg = data.compressed.alg;
                data = decompressData(compressedData, compressionAlg);
            }
            listenersRef.current.forEach((fn)=>fn(clientEventName, data)
            );
        });
    }, [
        Pusher,
        apiOrigin,
        pusherKey,
        debug,
        user,
        accessToken
    ]);
    const serverConnection = React.useMemo(()=>({
            send,
            addListener
        })
    , [
        send,
        addListener
    ]);
    return(/*#__PURE__*/ React.createElement(Context$1.Provider, {
        value: serverConnection
    }, children));
};
const useServerConnection = ()=>React.useContext(Context$1)
;

const omitKey = (key, obj)=>Object.fromEntries(Object.entries(obj).filter((param)=>{
        let [key_] = param;
        return key_ !== key;
    }))
;
const mapValues = (mapper, obj)=>Object.fromEntries(Object.entries(obj).map((param)=>{
        let [key, value] = param;
        return [
            key,
            mapper(value, key, obj)
        ];
    }))
;

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
    }, {})
;
const groupBy = (computeKey, list)=>list.reduce((acc, item)=>{
        const key = computeKey(item, list);
        const group = acc[key] ?? [];
        acc[key] = [
            ...group,
            item
        ];
        return acc;
    }, {})
;
const unique = (list)=>[
        ...new Set(list)
    ]
;

const initialState$2 = {
    entriesById: {}
};
const reducer$1 = function() {
    let state = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : initialState$2, action = arguments.length > 1 ? arguments[1] : void 0;
    switch(action.type){
        case "server-event:user-data":
            return {
                ...state,
                entriesById: indexBy((s)=>s.id
                , action.data.servers)
            };
        default:
            return state;
    }
};
const selectServer = (state)=>(id)=>state.servers.entriesById[id]
;

const readTimestampByChannelId = function() {
    let state = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {}, action = arguments.length > 1 ? arguments[1] : void 0;
    switch(action.type){
        case "server-event:user-data":
            {
                const timestampsByChannelId = mapValues((s)=>new Date(s.last_read_at).getTime()
                , indexBy((s)=>s.channel
                , action.data.read_states));
                return {
                    ...state,
                    ...timestampsByChannelId
                };
            }
        case "mark-channel-read":
            return {
                ...state,
                [action.data.channelId]: action.data.date.getTime()
            };
        case "message-create-request-sent":
        case "message-create-request-successful":
            return {
                ...state,
                [action.message.channel]: new Date(action.message.created_at).getTime()
            };
        case "server-event:message-created":
            {
                // Mark channels as read when receiving the user’s own messages.
                // This only matters when the same user is logged in on multiple clients.
                if (action.data.message.author === action.user.id) return {
                    ...state,
                    [action.data.message.channel]: new Date(action.data.message.created_at).getTime()
                };
                return state;
            }
        default:
            return state;
    }
};
const lastMessageTimestampByChannelId = function() {
    let state = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {}, action = arguments.length > 1 ? arguments[1] : void 0;
    switch(action.type){
        case "server-event:user-data":
            {
                const allChannels = action.data.servers.flatMap((s)=>s.channels
                );
                const timestampsByChannelId = mapValues((c)=>new Date(c.last_message_at).getTime()
                , indexBy((c)=>c.id
                , allChannels));
                return {
                    ...state,
                    ...timestampsByChannelId
                };
            }
        case "server-event:message-created":
            return {
                ...state,
                [action.data.message.channel]: new Date(action.data.message.created_at).getTime()
            };
        default:
            return state;
    }
};
const selectServerChannels = (state)=>(serverId)=>{
        const server = selectServer(state)(serverId);
        if (server == null) return [];
        return server.channels.map((c)=>{
            const lastReadTimestamp = state.channels.readTimestampByChannelId[c.id];
            const lastMessageTimestamp = state.channels.lastMessageTimestampByChannelId[c.id];
            return {
                ...c,
                hasUnread: lastReadTimestamp == null || lastReadTimestamp < lastMessageTimestamp
            };
        });
    }
;
var channels = combineReducers({
    readTimestampByChannelId,
    lastMessageTimestampByChannelId
});

const entriesById = function() {
    let state = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {}, action = arguments.length > 1 ? arguments[1] : void 0;
    switch(action.type){
        case "messages-fetched":
            return {
                ...state,
                ...indexBy((m)=>m.id
                , action.messages)
            };
        case "server-event:message-created":
            return {
                ...state,
                [action.data.message.id]: action.data.message
            };
        case "message-create-request-sent":
            return {
                ...state,
                [action.message.id]: action.message
            };
        case "message-create-request-successful":
            return {
                // Remove the optimistic entry
                ...omitKey(action.optimisticEntryId, state),
                [action.message.id]: action.message
            };
        default:
            return state;
    }
};
const entryIdsByChannelId = function() {
    let state = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {}, action = arguments.length > 1 ? arguments[1] : void 0;
    switch(action.type){
        case "messages-fetched":
            {
                const messageIdsByChannelId = mapValues((ms)=>ms.map((m)=>m.id
                    )
                , groupBy((m)=>m.channel
                , action.messages));
                return {
                    ...state,
                    ...messageIdsByChannelId
                };
            }
        case "server-event:message-created":
            {
                const channelId = action.data.message.channel;
                const channelMessageIds = state[channelId] ?? [];
                return {
                    ...state,
                    [channelId]: unique([
                        ...channelMessageIds,
                        action.data.message.id
                    ])
                };
            }
        case "message-create-request-sent":
            {
                const channelId = action.message.channel;
                const channelMessageIds = state[channelId] ?? [];
                return {
                    ...state,
                    [channelId]: [
                        ...channelMessageIds,
                        action.message.id
                    ]
                };
            }
        case "message-create-request-successful":
            {
                const channelId = action.message.channel;
                const channelMessageIds = state[channelId] ?? [];
                return {
                    ...state,
                    [channelId]: [
                        // Remove the optimistic entry
                        ...channelMessageIds.filter((id)=>id !== action.optimisticEntryId
                        ),
                        action.message.id, 
                    ]
                };
            }
        default:
            return state;
    }
};
const selectChannelMessages = (state)=>(channelId)=>{
        const channelMessageIds = state.messages.entryIdsByChannelId[channelId] ?? [];
        return channelMessageIds.map((id)=>state.messages.entriesById[id]
        );
    }
;
var messages = combineReducers({
    entriesById,
    entryIdsByChannelId
});

const initialState$1 = {
    entriesById: {},
    entriesByUserId: {},
    entryIdsByServerId: []
};
const reducer = function() {
    let state = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : initialState$1, action = arguments.length > 1 ? arguments[1] : void 0;
    switch(action.type){
        case "server-event:user-data":
            {
                const members1 = action.data.servers.flatMap((s)=>s.members
                );
                const membersById = indexBy((m)=>m.id
                , members1);
                const membersByUserId = indexBy((m)=>m.user
                , members1);
                const memberIdsByServerId = mapValues((members)=>members.map((m)=>m.id
                    )
                , groupBy((m)=>m.server
                , members1));
                return {
                    entriesById: membersById,
                    entriesByUserId: membersByUserId,
                    entryIdsByServerId: memberIdsByServerId
                };
            }
        default:
            return state;
    }
};
const selectServerMembersByUserId = (state)=>(serverId)=>{
        const memberIds = state.serverMembers.entryIdsByServerId[serverId] ?? [];
        return indexBy((m)=>m.user
        , memberIds.map((id)=>state.serverMembers.entriesById[id]
        ));
    }
;

const selectors = {
    selectServerChannels,
    selectChannelMessages,
    selectServer,
    selectServerMembersByUserId
};
const rootReducer = combineReducers({
    servers: reducer$1,
    channels,
    serverMembers: reducer,
    messages
});
const initialState = rootReducer(undefined, {});
const applyStateToSelectors = (selectors1, state)=>mapValues((selector)=>selector(state)
    , selectors1)
;
const useRootReducer = ()=>{
    const [state, dispatch] = React.useReducer(rootReducer, initialState);
    const appliedSelectors = applyStateToSelectors(selectors, state);
    return [
        appliedSelectors,
        dispatch
    ];
};

const Context = /*#__PURE__*/ React.createContext({});
const useAppScope = ()=>React.useContext(Context)
;
const Provider = (param1)=>{
    let { children  } = param1;
    const { user , authorizedFetch  } = useAuth();
    const serverConnection = useServerConnection();
    const [stateSelectors, dispatch] = useRootReducer();
    const sendServerMessage = React.useCallback((name, data)=>{
        const messageSent = serverConnection.send(name, data);
        // Dispatch a client action if the message was successfully sent
        if (messageSent) dispatch({
            type: name,
            data
        });
        return messageSent;
    }, [
        dispatch,
        serverConnection
    ]);
    const fetchUserData = React.useCallback(()=>{
        sendServerMessage("request-user-data");
    }, [
        sendServerMessage
    ]);
    const fetchMessages = React.useCallback((param)=>{
        let { channelId  } = param;
        return authorizedFetch(`/channels/${channelId}/messages`).then((messages)=>{
            dispatch({
                type: "messages-fetched",
                messages
            });
            return messages;
        });
    }, [
        authorizedFetch,
        dispatch
    ]);
    const createServer = React.useCallback((param)=>{
        let { name  } = param;
        return authorizedFetch("/servers", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                name
            })
        }).then((res)=>{
            // TODO
            fetchUserData();
            return res;
        });
    }, [
        authorizedFetch,
        fetchUserData
    ]);
    const markChannelRead = React.useCallback((param)=>{
        let { channelId , date =new Date()  } = param;
        sendServerMessage("mark-channel-read", {
            channelId,
            date
        });
    }, [
        sendServerMessage
    ]);
    const createMessage = React.useCallback(async (param)=>{
        let { server , channel , content  } = param;
        // TODO: Less hacky optimistc UI
        const message1 = {
            server,
            channel,
            content
        };
        const dummyId = generateDummyId();
        dispatch({
            type: "message-create-request-sent",
            message: {
                ...message1,
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
            body: JSON.stringify(message1)
        }).then((message)=>{
            dispatch({
                type: "message-create-request-successful",
                message,
                optimisticEntryId: dummyId
            });
            markChannelRead({
                channelId: channel
            });
            return message;
        });
    }, [
        authorizedFetch,
        user,
        markChannelRead,
        dispatch
    ]);
    const createChannel = React.useCallback((param)=>{
        let { name , kind , server  } = param;
        return authorizedFetch("/channels", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                name,
                kind,
                server
            })
        }).then((res)=>{
            // TODO
            fetchUserData();
            return res;
        });
    }, [
        authorizedFetch,
        fetchUserData
    ]);
    const actions = React.useMemo(()=>({
            fetchUserData,
            fetchMessages,
            createServer,
            createChannel,
            createMessage,
            markChannelRead
        })
    , [
        fetchUserData,
        fetchMessages,
        createServer,
        createChannel,
        createMessage,
        markChannelRead, 
    ]);
    React.useEffect(()=>{
        const handler = (name, data)=>{
            dispatch({
                type: [
                    "server-event",
                    name
                ].join(":"),
                data,
                user
            });
        };
        const removeListener = serverConnection.addListener(handler);
        return ()=>{
            removeListener();
        };
    }, [
        user,
        serverConnection,
        dispatch
    ]);
    const contextValue = React.useMemo(()=>({
            state: stateSelectors,
            actions
        })
    , [
        stateSelectors,
        actions
    ]);
    return(/*#__PURE__*/ React.createElement(Context.Provider, {
        value: contextValue
    }, children));
};

export { Provider as AppScopeProvider, Provider$2 as AuthProvider, Provider$1 as ServerConnectionProvider, useAppScope, useAuth, useServerConnection };
