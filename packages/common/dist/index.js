import React from 'react';

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
const useAccessToken = function() {
    let { storage =window.localStorage  } = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
    const [token1, setToken] = React.useState(()=>storage.getItem(ACCESS_TOKEN_CACHE_KEY)
    );
    const set = React.useCallback((token)=>{
        setToken(token);
        storage.setItem(ACCESS_TOKEN_CACHE_KEY, token);
    }, [
        storage
    ]);
    const clear = React.useCallback(()=>{
        setToken(null);
        storage.removeItem(ACCESS_TOKEN_CACHE_KEY);
    }, [
        storage
    ]);
    return [
        token1,
        {
            set,
            clear
        }
    ];
};
const AuthContext = /*#__PURE__*/ React.createContext(null);
const useAuth = ()=>React.useContext(AuthContext)
;
const Provider = (param1)=>{
    let { apiBase , ...props } = param1;
    const [accessToken, { set: setAccessToken , clear: clearAccessToken  }] = useAccessToken();
    const [user1, setUser] = React.useState(null);
    const isSignedIn = accessToken != null;
    const signIn = React.useCallback(async (param)=>{
        let { message , signature , address , signedAt , nonce  } = param;
        const responseBody = await fetch(`${apiBase}/auth/login`, {
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
        apiBase,
        setAccessToken
    ]);
    const authorizedFetch = React.useCallback(async (url, options)=>{
        if (accessToken == null) throw new Error("Missing access token");
        const headers = new Headers(options?.headers);
        headers.append("Authorization", `Bearer ${accessToken}`);
        const response = await fetch(`${apiBase}${url}`, {
            ...options,
            headers
        });
        if (response.status === 401) clearAccessToken();
        if (response.ok) return response.json();
        return Promise.reject(new Error(response.statusText));
    }, [
        apiBase,
        accessToken,
        clearAccessToken
    ]);
    const contextValue = React.useMemo(()=>({
            isSignedIn,
            accessToken,
            user: user1,
            authorizedFetch,
            signIn
        })
    , [
        isSignedIn,
        accessToken,
        user1,
        authorizedFetch,
        signIn
    ]);
    React.useEffect(()=>{
        if (!isSignedIn) return;
        authorizedFetch("/users/me").then((user)=>{
            setUser(user);
        });
    }, [
        authorizedFetch,
        isSignedIn
    ]);
    return(/*#__PURE__*/ React.createElement(AuthContext.Provider, _extends({
        value: contextValue
    }, props)));
};

export { Provider as AuthProvider, useAuth };
