#ifndef YUNLI_NATIVE_TOOLS_H
#define YUNLI_NATIVE_TOOLS_H

#define WIN32_LEAN_AND_MEAN
#include <windows.h>

#define YUNLI_IPC_MAGIC 0x594C4950UL /* 'YLIP' */

#ifdef YUNLI_NATIVE_EXPORTS
#define YUNLI_NATIVE_API __declspec(dllexport)
#else
#define YUNLI_NATIVE_API
#endif

typedef int (*YunLiAcquireSuiteFn)(const char *name, int version, const void **suite);
typedef void (*YunLiLogFn)(const char *stage, long code);

typedef void (__cdecl *YunLiNativeInitFn)(void *basicSuite, void *pluginSelf, void *unicodeSuite, YunLiLogFn logFn);
typedef void (__cdecl *YunLiNativeShutdownFn)(void);
typedef int  (__cdecl *YunLiNativeHandleCopyDataFn)(const COPYDATASTRUCT *cds);

YUNLI_NATIVE_API void __cdecl YunLiNativeInit(void *basicSuite, void *pluginSelf, void *unicodeSuite, YunLiLogFn logFn);
YUNLI_NATIVE_API void __cdecl YunLiNativeShutdown(void);
YUNLI_NATIVE_API int  __cdecl YunLiNativeHandleCopyData(const COPYDATASTRUCT *cds);

#endif
