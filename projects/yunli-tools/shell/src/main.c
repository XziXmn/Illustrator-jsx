/* =========================================================================
 * YunLi工具箱 Illustrator 插件壳 (YunLiTools.aip)
 *
 * 职责(类型布局全部核对官方 AI 2027 SDK 头文件):
 *   1. PIPL 声明的 PluginMain(caller, selector, message) 字符串消息分发
 *   2. "SP Interface"/"Startup": AcquireSuite 取套件, 注册「窗口→YunLi工具箱」
 *      菜单项, 注册应用退出与选区变更通知, 动态加载可热重载的 YunLiNative.dll
 *   3. "AI Menu"/"AI Go": 已有面板则 Show;否则创建 AIPanel + 启动载荷进程
 *      (优先级: YUNLI_PAYLOAD_DIR > 热更目录 hot\<current.txt> > payload\ > 资源 10/101),
 *      EnumWindows 找到子进程主窗口后 SetParent 嵌入面板
 *   4. 热更新重载: 收到 WM_YUNLI_RELOAD 后等待旧核心退出, 卸载并重载
 *      YunLiNative.dll, 重新拉起新核心并停靠; 若热更版本启动失败自动回滚
 *   5. 面板尺寸变化回调同步子窗口尺寸; 退出通知/Shutdown 清理
 *
 * 槽位核对出处(AI 2027 SDK):
 *   SPBasic.h            SPBasicSuite slot0 AcquireSuite
 *   AIMenu.h  v11        AddMenuItem @slot0
 *   AIMenuUtils.h        AIPlatformAddMenuItemDataUS / AIMenuMessage(+0x20)
 *   AIUnicodeString.h v10 InitializeUTF16 @slot1, Destroy @slot3
 *   AIPanel.h v4         Create@0 Destroy@1 GetPlatformWindow@2 Show@3
 *                        SetSizeChangedNotifyProc@36
 *   AINotifier.h v5      AddNotifier @slot0(通知经 PluginMain 回来)
 *   SPMData.h            SPMessageData {SPCheck, self, globals, basic}
 * ========================================================================= */
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <shlobj.h>
#include <stdint.h>
#include <wchar.h>
#include <string.h>
#include <stdio.h>
#include "native_tools.h"

/* ---------------- SDK 类型(与官方头文件布局一致) ---------------- */
typedef int SPErr;                        /* 4cc 错误码, 0 = kNoErr */
typedef struct SPPlugin *SPPluginRef;
typedef void *AIMenuItemHandle;
typedef void *AIPanelRef;
typedef void *AINotifierHandle;
typedef double AIReal;                    /* 64 位 Illustrator: AIReal = double */

struct SPMessageData {                    /* SPMData.h */
    int SPCheck;                          /* +0x00 */
    struct SPPlugin *self;                /* +0x08 */
    void *globals;                        /* +0x10 */
    struct SPBasicSuite *basic;           /* +0x18 */
};
typedef struct SPMessageData SPMessageData;

struct SPBasicSuite {                     /* SPBasic.h, 仅声明用到的槽位 */
    SPErr (*AcquireSuite)(const char *name, int version, const void **suite);
};
typedef struct SPBasicSuite SPBasicSuite;

struct SPInterfaceMessage { SPMessageData d; };
struct AIMenuMessage      { SPMessageData d; void *menuItem; };   /* +0x20 */
struct AINotifierMessage {                /* AINotifier.h */
    SPMessageData d;
    AINotifierHandle notifier;
    const char *type;
    void *notifyData;
    int isParallelDispatch;
};

/* ai::UnicodeString ABI = 单个 fImpl 指针 (IAIUnicodeString.h:1356) */
typedef struct { void *fImpl; } UStr;
struct AISize { AIReal width; AIReal height; };
typedef struct AISize AISize;

struct AIPlatformAddMenuItemDataUS {      /* AIMenuUtils.h */
    const char *groupName;
    UStr itemText;
};
typedef struct AIPlatformAddMenuItemDataUS AIPlatformAddMenuItemDataUS;

typedef void (*PanelSizeChangedProc)(AIPanelRef);
typedef void (*PanelStateChangedProc)(AIPanelRef, short);
typedef void (*PanelVisibilityChangedProc)(AIPanelRef, int);
typedef void (*PanelClosedProc)(AIPanelRef);

struct AIMenuSuite {                      /* v11, 仅声明用到的槽位 */
    SPErr (*AddMenuItem)(SPPluginRef self, const char *shortcutKey,
                         struct AIPlatformAddMenuItemDataUS *data, int options,
                         AIMenuItemHandle *item);
};

struct AIUnicodeStringSuite {             /* v10 */
    void *Initialize;                                              /* slot0 */
    SPErr (*InitializeUTF16)(UStr *str, const unsigned short *utf16, int count);
    void *InitializeUTF32Char;                                     /* slot2 */
    SPErr (*Destroy)(UStr *str);                                   /* slot3 */
};

struct AIPanelSuite {                     /* v4, 槽位见 AIPanel.h */
    SPErr (*Create)(SPPluginRef self, UStr *inID, UStr *inTitle,
                    short inStateCount, struct AISize *inMinSize, int isResizable,
                    void *inFlyoutMenu, void *inUserData, AIPanelRef *outPanel);
    SPErr (*Destroy)(AIPanelRef inPanel);                          /* slot1 */
    SPErr (*GetPlatformWindow)(AIPanelRef inPanel, HWND *out);     /* slot2 */
    SPErr (*Show)(AIPanelRef inPanel, int inShow);                 /* slot3 */
    void *pad4_8[5];                                               /* slot4..8 */
    void *SetIcon;                                                 /* slot9 */
    void *SetIconResourceID;                                       /* slot10 */
    SPErr (*SetSVGIconResourceID)(AIPanelRef inPanel, unsigned int iconResId,
                                  unsigned int darkIconResId);      /* slot11 */
    void *pad12;                                                   /* slot12 */
    SPErr (*SetMinimumSize)(AIPanelRef inPanel, struct AISize *s); /* slot13 */
    void *pad14_16[3];                                             /* slot14..16 */
    SPErr (*SetPreferredSizes)(AIPanelRef inPanel, struct AISize *s); /* slot17 */
    void *pad18_34[17];                                            /* slot18..34 */
    SPErr (*SetVisibilityChangedNotifyProc)(AIPanelRef, PanelVisibilityChangedProc); /* slot35 */
    SPErr (*SetSizeChangedNotifyProc)(AIPanelRef, PanelSizeChangedProc);   /* slot36 */
    SPErr (*SetStateChangedNotifyProc)(AIPanelRef, PanelStateChangedProc); /* slot37 */
    SPErr (*SetClosedNotifyProc)(AIPanelRef, PanelClosedProc);             /* slot38 */
};

struct AINotifierSuite {                  /* v5 */
    SPErr (*AddNotifier)(SPPluginRef self, const char *name, const char *type,
                         AINotifierHandle *notifier);               /* slot0 */
};

/* ---------------- 选择子/套件名(SDK 宏原样) ---------------- */
static const char kCallerSP[]         = "SP Interface";
static const char kSelStartup[]       = "Startup";
static const char kSelShutdown[]      = "Shutdown";
static const char kCallerMenu[]       = "AI Menu";
static const char kSelMenuGo[]        = "AI Go";
static const char kCallerNotifier[]   = "AI Notifier";
static const char kSelNotify[]        = "AI Notify";
static const char kNotifShutdown[]    = "AI Application Shutdown Notifier";
static const char kNotifSelChanged[]  = "AI Art Selection Changed Notifier";
static const char kNotifPropChanged[] = "AI Art Properties Changed Notifier";
static const char kNotifDocChanged[]  = "AI Document Changed Notifier";
static const char kSuiteMenu[]        = "AI Menu Suite";
static const char kSuiteUString[]     = "AI Unicode String Suite";
static const char kSuitePanel[]       = "AI Panel Suite";
static const char kSuiteNotifier[]    = "AI Notifier Suite";

#define kNoErr              0
#define kMissingBasicErr    ((SPErr)0x5041524D)  /* 'PARM' */
#define kMissingSuiteErr    ((SPErr)0x594D4553)  /* 'YMES' */

#define MENU_KEY            "YunLi.Tools.Panel"
#define MENU_GROUP          "Tool Palettes"          /* 窗口菜单分组 */
#define MENU_TEXT_W         L"YunLi工具箱"
#define PANEL_ID_W          L"YunLi.Panel"
#define PANEL_TITLE_W       L"YunLi工具箱"
#define CHILD_TITLE         L"YunLiPanel"            /* 核心进程窗体标题前缀 */
#define PAYLOAD_EXE         L"YunLiCore.exe"
#define NATIVE_DLL          L"YunLiNative.dll"
#define NOTIFIER_SHUTDOWN   "YunLi.Shutdown"
#define NOTIFIER_SELECTION  "YunLi.Selection"
#define NOTIFIER_PROPERTIES "YunLi.Properties"
#define NOTIFIER_DOCUMENT   "YunLi.Document"

#define YUNLI_SHELL_VERSION 2
#ifndef YUNLI_BASE_VERSION
#define YUNLI_BASE_VERSION  "0.4.1"
#endif

/* ---------------- 全局状态 ---------------- */
static struct {
    struct SPBasicSuite *basic;
    SPPluginRef self;
    AIMenuItemHandle menuItem;
    struct AIMenuSuite *menu;
    struct AIUnicodeStringSuite *ustr;
    struct AIPanelSuite *panelSuite;
    struct AINotifierSuite *notifierSuite;
    AINotifierHandle notifShutdown;
    AINotifierHandle notifSelChanged;
    AINotifierHandle notifPropChanged;
    AINotifierHandle notifDocChanged;
    AIPanelRef panel;
    HWND panelWindow;
    HWND childWindow;
    HANDLE childProcess;
    HANDLE childThread;
    HMODULE hSelf;
    HMODULE nativeMod;
    YunLiNativeInitFn nativeInit;
    YunLiNativeShutdownFn nativeShutdown;
    YunLiNativeHandleCopyDataFn nativeHandleCopyData;
    HWND msgWnd;              /* 隐藏消息窗:快捷键、IPC 与热重载轮询 */
    HHOOK keyboardHook;
    DWORD childPid;
    int dockTries;
    int usingHot;
    int rollbackAttempted;
    int reloading;
    int reloadTries;
    int shuttingDown;
} S;

#define WM_YUNLI_SHOW        (WM_APP + 1)
#define WM_YUNLI_DOCK        (WM_APP + 2)
#define WM_YUNLI_SEL_CHANGED (WM_APP + 10)
#define WM_YUNLI_RELOAD      (WM_APP + 11)
#define DOCK_TIMER_ID        1
#define REFIT_TIMER_ID       2
#define RELOAD_TIMER_ID      3
#define PANEL_ICON_LIGHT     200
#define PANEL_ICON_DARK      201

/* ---------------- 日志: %LOCALAPPDATA%\YunLi\startup.log ---------------- */
static void Log(const char *stage, long code)
{
    wchar_t path[MAX_PATH];
    if (FAILED(SHGetFolderPathW(NULL, CSIDL_LOCAL_APPDATA, NULL, 0, path))) return;
    lstrcatW(path, L"\\YunLi");
    CreateDirectoryW(path, NULL);
    lstrcatW(path, L"\\startup.log");

    SYSTEMTIME st; GetLocalTime(&st);
    HANDLE h = CreateFileW(path, FILE_APPEND_DATA, FILE_SHARE_READ, NULL,
                           OPEN_ALWAYS, FILE_ATTRIBUTE_NORMAL, NULL);
    if (h == INVALID_HANDLE_VALUE) return;
    char line[512];
    int n = _snprintf(line, sizeof(line),
                      "%04u-%02u-%02u %02u:%02u:%02u.%03u %s code=0x%08lX\r\n",
                      st.wYear, st.wMonth, st.wDay, st.wHour, st.wMinute,
                      st.wSecond, st.wMilliseconds, stage, code);
    DWORD w = 0;
    WriteFile(h, line, (DWORD)n, &w, NULL);
    CloseHandle(h);
}

/* ---------------- 套件获取 ---------------- */
static SPErr AcquireAll(void)
{
    SPErr err;
    if (!S.basic) return kMissingBasicErr;
    err = S.basic->AcquireSuite(kSuiteMenu, 11, (const void **)&S.menu);
    if (err) { Log("acquire-menu-11", err); return kMissingSuiteErr; }
    err = S.basic->AcquireSuite(kSuiteUString, 10, (const void **)&S.ustr);
    if (err) { Log("acquire-ustring-10", err); return kMissingSuiteErr; }
    err = S.basic->AcquireSuite(kSuitePanel, 4, (const void **)&S.panelSuite);
    if (err) { Log("acquire-panel-4", err); return kMissingSuiteErr; }
    err = S.basic->AcquireSuite(kSuiteNotifier, 5, (const void **)&S.notifierSuite);
    if (err) { Log("acquire-notifier-5", err); return kMissingSuiteErr; }
    return kNoErr;
}

/* ---------------- 菜单注册 ---------------- */
static SPErr RegisterMenu(void)
{
    UStr text = {0};
    SPErr err = S.ustr->InitializeUTF16(&text, (const unsigned short *)MENU_TEXT_W,
                                        (int)wcslen(MENU_TEXT_W));
    if (err) { Log("menu-label-utf16", err); return err; }
    struct AIPlatformAddMenuItemDataUS data;
    data.groupName = MENU_GROUP;
    data.itemText  = text;
    err = S.menu->AddMenuItem(S.self, MENU_KEY, &data, 0, &S.menuItem);
    S.ustr->Destroy(&text);
    Log("register-menu", err);
    return err;
}

/* ---------------- 版本比较与热更新目录管理 ---------------- */
static BOOL FileExistsW(const wchar_t *p)
{
    DWORD a = GetFileAttributesW(p);
    return a != INVALID_FILE_ATTRIBUTES && !(a & FILE_ATTRIBUTE_DIRECTORY);
}

static BOOL SafeVersionA(const char *s)
{
    if (!s || !s[0]) return FALSE;
    size_t len = strlen(s);
    if (len > 48) return FALSE;
    for (size_t i = 0; i < len; i++) {
        char c = s[i];
        BOOL ok = (c >= '0' && c <= '9') || (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')
                  || c == '.' || c == '-' || c == '_';
        if (!ok) return FALSE;
    }
    return TRUE;
}

static int CompareVerA(const char *a, const char *b)
{
    const char *pa = a ? a : "";
    const char *pb = b ? b : "";
    while (*pa || *pb) {
        long va = 0, vb = 0;
        while (*pa >= '0' && *pa <= '9') { va = va * 10 + (*pa - '0'); pa++; }
        while (*pb >= '0' && *pb <= '9') { vb = vb * 10 + (*pb - '0'); pb++; }
        if (va != vb) return va < vb ? -1 : 1;
        while (*pa && *pa != '.') pa++;
        while (*pb && *pb != '.') pb++;
        if (*pa == '.') pa++;
        if (*pb == '.') pb++;
    }
    return 0;
}

static BOOL ReadTrimmedFileA(const wchar_t *path, char *out, size_t cap)
{
    if (!out || cap < 2) return FALSE;
    out[0] = 0;
    HANDLE h = CreateFileW(path, GENERIC_READ, FILE_SHARE_READ | FILE_SHARE_WRITE,
                           NULL, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, NULL);
    if (h == INVALID_HANDLE_VALUE) return FALSE;
    DWORD read = 0;
    BOOL ok = ReadFile(h, out, (DWORD)(cap - 1), &read, NULL);
    CloseHandle(h);
    if (!ok || read == 0) { out[0] = 0; return FALSE; }
    out[read] = 0;
    /* 跳过 UTF-8 BOM */
    if (read >= 3 && (unsigned char)out[0] == 0xEF &&
        (unsigned char)out[1] == 0xBB && (unsigned char)out[2] == 0xBF) {
        memmove(out, out + 3, read - 2);
    }
    size_t len = strlen(out);
    while (len > 0 && (out[len - 1] == '\r' || out[len - 1] == '\n' ||
                       out[len - 1] == ' '  || out[len - 1] == '\t')) {
        out[--len] = 0;
    }
    return len > 0;
}

static BOOL WriteStringAtomicA(const wchar_t *path, const char *text)
{
    wchar_t tmp[MAX_PATH];
    _snwprintf(tmp, MAX_PATH, L"%s.tmp", path);
    tmp[MAX_PATH - 1] = 0;
    HANDLE h = CreateFileW(tmp, GENERIC_WRITE, 0, NULL, CREATE_ALWAYS,
                           FILE_ATTRIBUTE_NORMAL, NULL);
    if (h == INVALID_HANDLE_VALUE) return FALSE;
    DWORD len = (DWORD)strlen(text);
    DWORD written = 0;
    BOOL ok = WriteFile(h, text, len, &written, NULL) && written == len;
    CloseHandle(h);
    if (!ok) { DeleteFileW(tmp); return FALSE; }
    return MoveFileExW(tmp, path, MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH);
}

static BOOL GetHotRoot(wchar_t *out, DWORD cch)
{
    wchar_t base[MAX_PATH];
    if (FAILED(SHGetFolderPathW(NULL, CSIDL_LOCAL_APPDATA, NULL, 0, base))) return FALSE;
    _snwprintf(out, cch, L"%s\\YunLi\\hot", base);
    out[cch - 1] = 0;
    return TRUE;
}

/* 若存在有效且不低于当前 .aip 基线版本的热更目录, 返回其路径 */
static BOOL ReadActiveHotDir(wchar_t *outDir, DWORD cch)
{
    wchar_t hotRoot[MAX_PATH], curFile[MAX_PATH];
    if (!GetHotRoot(hotRoot, MAX_PATH)) return FALSE;
    _snwprintf(curFile, MAX_PATH, L"%s\\current.txt", hotRoot);
    curFile[MAX_PATH - 1] = 0;

    char ver[64];
    if (!ReadTrimmedFileA(curFile, ver, sizeof(ver))) return FALSE;
    if (!SafeVersionA(ver)) return FALSE;
    /* 用户安装更新的完整 .aip 后, 自动忽略旧于新基线的历史热更包 */
    if (CompareVerA(ver, YUNLI_BASE_VERSION) < 0) return FALSE;

    wchar_t wver[64];
    if (MultiByteToWideChar(CP_UTF8, 0, ver, -1, wver, 64) <= 0) return FALSE;
    _snwprintf(outDir, cch, L"%s\\%s", hotRoot, wver);
    outDir[cch - 1] = 0;

    wchar_t coreCheck[MAX_PATH];
    _snwprintf(coreCheck, MAX_PATH, L"%s\\%s", outDir, PAYLOAD_EXE);
    coreCheck[MAX_PATH - 1] = 0;
    return FileExistsW(coreCheck);
}

static void RollbackHotVersion(void)
{
    wchar_t hotRoot[MAX_PATH], curFile[MAX_PATH], prevFile[MAX_PATH];
    if (!GetHotRoot(hotRoot, MAX_PATH)) return;
    _snwprintf(curFile, MAX_PATH, L"%s\\current.txt", hotRoot);
    _snwprintf(prevFile, MAX_PATH, L"%s\\previous.txt", hotRoot);
    curFile[MAX_PATH - 1] = 0;
    prevFile[MAX_PATH - 1] = 0;

    char curVer[64] = {0}, prevVer[64] = {0};
    ReadTrimmedFileA(curFile, curVer, sizeof(curVer));
    if (ReadTrimmedFileA(prevFile, prevVer, sizeof(prevVer)) &&
        SafeVersionA(prevVer) &&
        strcmp(prevVer, curVer) != 0 &&
        CompareVerA(prevVer, YUNLI_BASE_VERSION) >= 0) {
        wchar_t wprev[64], checkExe[MAX_PATH];
        if (MultiByteToWideChar(CP_UTF8, 0, prevVer, -1, wprev, 64) > 0) {
            _snwprintf(checkExe, MAX_PATH, L"%s\\%s\\%s", hotRoot, wprev, PAYLOAD_EXE);
            checkExe[MAX_PATH - 1] = 0;
            if (FileExistsW(checkExe) && WriteStringAtomicA(curFile, prevVer)) {
                DeleteFileW(prevFile);
                Log("hot-rollback-prev", 0);
                return;
            }
        }
    }
    DeleteFileW(curFile);
    DeleteFileW(prevFile);
    Log("hot-rollback-base", 0);
}

/* ---------------- 载荷与原生 DLL 定位/解包 ---------------- */
static BOOL FindEnvFile(const wchar_t *fileName, wchar_t *out, DWORD cch)
{
    char env[MAX_PATH];
    if (GetEnvironmentVariableA("YUNLI_PAYLOAD_DIR", env, MAX_PATH)) {
        wchar_t wenv[MAX_PATH];
        if (MultiByteToWideChar(CP_ACP, 0, env, -1, wenv, MAX_PATH) > 0) {
            _snwprintf(out, cch, L"%s\\%s", wenv, fileName);
            out[cch - 1] = 0;
            if (FileExistsW(out)) return TRUE;
        }
    }
    return FALSE;
}

static BOOL FindAdjacentPayloadFile(const wchar_t *fileName, wchar_t *out, DWORD cch)
{
    wchar_t aip[MAX_PATH];
    GetModuleFileNameW(S.hSelf, aip, MAX_PATH);
    wchar_t *slash = wcsrchr(aip, L'\\');
    if (slash) *slash = 0;
    _snwprintf(out, cch, L"%s\\payload\\%s", aip, fileName);
    out[cch - 1] = 0;
    return FileExistsW(out);
}

/* 发布模式: 资源 10/<resId> → %LOCALAPPDATA%\YunLi\<sha256>\<fileName> */
static BOOL ExtractResource(int resId, const wchar_t *fileName, wchar_t *out, DWORD cch)
{
    HRSRC r = FindResourceW(S.hSelf, MAKEINTRESOURCEW(resId), MAKEINTRESOURCEW(10));
    if (!r) { Log("panel-resource", resId); return FALSE; }
    HGLOBAL g = LoadResource(S.hSelf, r);
    void *p = LockResource(g);
    DWORD size = SizeofResource(S.hSelf, r);
    if (!p || !size) { Log("panel-resource-data", resId); return FALSE; }

    wchar_t hex[65] = {0};
    HMODULE bc = LoadLibraryW(L"bcrypt.dll");
    if (bc) {
        typedef long (*OpenFn)(void **, const wchar_t *, unsigned long, unsigned long);
        typedef long (*HashFn)(void *, void *, unsigned long, const unsigned char *,
                               unsigned long, unsigned char *, unsigned long,
                               unsigned long, unsigned long);
        typedef long (*CloseFn)(void *, unsigned long);
        OpenFn op = (OpenFn)(void *)GetProcAddress(bc, "BCryptOpenAlgorithmProvider");
        HashFn hs = (HashFn)(void *)GetProcAddress(bc, "BCryptHash");
        CloseFn cl = (CloseFn)(void *)GetProcAddress(bc, "BCryptCloseAlgorithmProvider");
        if (op && hs && cl) {
            void *alg = NULL;
            if (op(&alg, L"SHA256", 0, 0) == 0) {
                unsigned char digest[32] = {0};
                if (hs(alg, NULL, 0, (const unsigned char *)p, size,
                       digest, 32, 0, 0) == 0) {
                    static const wchar_t *d = L"0123456789abcdef";
                    for (int i = 0; i < 32; i++) {
                        hex[i * 2] = d[digest[i] >> 4];
                        hex[i * 2 + 1] = d[digest[i] & 0xF];
                    }
                }
                cl(alg, 0);
            }
        }
        FreeLibrary(bc);
    }
    if (!hex[0]) { Log("hash", resId); return FALSE; }

    wchar_t base[MAX_PATH];
    if (FAILED(SHGetFolderPathW(NULL, CSIDL_LOCAL_APPDATA, NULL, 0, base))) return FALSE;
    wchar_t rootDir[MAX_PATH], dir[MAX_PATH];
    _snwprintf(rootDir, MAX_PATH, L"%s\\YunLi", base);
    rootDir[MAX_PATH - 1] = 0;
    CreateDirectoryW(rootDir, NULL);
    _snwprintf(dir, MAX_PATH, L"%s\\%s", rootDir, hex);
    dir[MAX_PATH - 1] = 0;
    CreateDirectoryW(dir, NULL);

    wchar_t tmp[MAX_PATH], finalp[MAX_PATH];
    _snwprintf(tmp, MAX_PATH, L"%s\\%s.tmp", dir, fileName);
    _snwprintf(finalp, MAX_PATH, L"%s\\%s", dir, fileName);
    tmp[MAX_PATH - 1] = 0;
    finalp[MAX_PATH - 1] = 0;

    /* 命中同 SHA-256 且大小一致的缓存文件时直接复用, 避免重复写入或文件占用冲突 */
    WIN32_FILE_ATTRIBUTE_DATA fad;
    if (GetFileAttributesExW(finalp, GetFileExInfoStandard, &fad) &&
        !(fad.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) &&
        fad.nFileSizeHigh == 0 && fad.nFileSizeLow == size) {
        _snwprintf(out, cch, L"%s", finalp);
        out[cch - 1] = 0;
        Log("extract-cached", resId);
        return TRUE;
    }

    HANDLE f = CreateFileW(tmp, GENERIC_WRITE, 0, NULL, CREATE_ALWAYS,
                           FILE_ATTRIBUTE_NORMAL, NULL);
    if (f == INVALID_HANDLE_VALUE) { Log("write-panel", GetLastError()); return FALSE; }
    DWORD w = 0;
    BOOL ok = WriteFile(f, p, size, &w, NULL) && w == size;
    CloseHandle(f);
    if (!ok) { DeleteFileW(tmp); Log("write-panel", GetLastError()); return FALSE; }
    if (!MoveFileExW(tmp, finalp, MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH)) {
        DeleteFileW(tmp);
        Log("replace-panel", GetLastError());
        return FALSE;
    }
    _snwprintf(out, cch, L"%s", finalp);
    out[cch - 1] = 0;
    Log("extract-written", resId);
    return TRUE;
}

static BOOL ResolvePayloadFile(const wchar_t *fileName, int resId,
                               wchar_t *out, DWORD cch, int *outIsHot)
{
    if (outIsHot) *outIsHot = 0;
    if (FindEnvFile(fileName, out, cch)) return TRUE;

    wchar_t hotDir[MAX_PATH];
    if (ReadActiveHotDir(hotDir, MAX_PATH)) {
        _snwprintf(out, cch, L"%s\\%s", hotDir, fileName);
        out[cch - 1] = 0;
        if (FileExistsW(out)) {
            if (outIsHot) *outIsHot = 1;
            return TRUE;
        }
    }

    if (FindAdjacentPayloadFile(fileName, out, cch)) return TRUE;
    return ExtractResource(resId, fileName, out, cch);
}

/* ---------------- 可热插拔原生 SDK 模块 (YunLiNative.dll) ---------------- */
static void UnloadNativeModule(void)
{
    if (S.nativeShutdown) S.nativeShutdown();
    S.nativeInit = NULL;
    S.nativeShutdown = NULL;
    S.nativeHandleCopyData = NULL;
    if (S.nativeMod) {
        FreeLibrary(S.nativeMod);
        S.nativeMod = NULL;
        Log("native-unloaded", 0);
    }
}

static BOOL TryLoadNativePath(const wchar_t *dllPath, int isHot)
{
    HMODULE mod = LoadLibraryW(dllPath);
    if (!mod) {
        Log("native-load-err", GetLastError());
        return FALSE;
    }
    YunLiNativeInitFn fnInit = (YunLiNativeInitFn)(void *)GetProcAddress(mod, "YunLiNativeInit");
    YunLiNativeShutdownFn fnShut = (YunLiNativeShutdownFn)(void *)GetProcAddress(mod, "YunLiNativeShutdown");
    YunLiNativeHandleCopyDataFn fnCopy = (YunLiNativeHandleCopyDataFn)(void *)GetProcAddress(mod, "YunLiNativeHandleCopyData");
    if (!fnInit || !fnShut || !fnCopy) {
        FreeLibrary(mod);
        Log("native-exports-missing", isHot);
        return FALSE;
    }
    S.nativeMod = mod;
    S.nativeInit = fnInit;
    S.nativeShutdown = fnShut;
    S.nativeHandleCopyData = fnCopy;
    S.nativeInit(S.basic, S.self, S.ustr, Log);
    Log("native-loaded", isHot);
    return TRUE;
}

static void LoadNativeModule(void)
{
    UnloadNativeModule();
    wchar_t dllPath[MAX_PATH];
    int isHot = 0;
    if (ResolvePayloadFile(NATIVE_DLL, 102, dllPath, MAX_PATH, &isHot)) {
        if (TryLoadNativePath(dllPath, isHot)) return;
    }
    /* 热更目录里的 YunLiNative.dll 若损坏, 立即兜底加载基线原生模块 */
    if (isHot) {
        if (FindAdjacentPayloadFile(NATIVE_DLL, dllPath, MAX_PATH) ||
            ExtractResource(102, NATIVE_DLL, dllPath, MAX_PATH)) {
            TryLoadNativePath(dllPath, 0);
        }
    }
}

/* ---------------- 子窗口查找与停靠 ---------------- */
struct FindChildCtx { DWORD pid; HWND hwnd; };

static BOOL CALLBACK FindChildProc(HWND hwnd, LPARAM lp)
{
    struct FindChildCtx *ctx = (struct FindChildCtx *)lp;
    DWORD pid = 0;
    GetWindowThreadProcessId(hwnd, &pid);
    if (pid != ctx->pid || !IsWindowVisible(hwnd)) return TRUE;
    wchar_t title[64] = {0};
    GetWindowTextW(hwnd, title, 64);
    if (wcsncmp(title, CHILD_TITLE, wcslen(CHILD_TITLE)) == 0) {
        ctx->hwnd = hwnd;
        return FALSE;
    }
    return TRUE;
}

static void FitDock(void)
{
    if (!S.panelSuite || !S.panel || !S.childWindow) return;
    HWND pw = NULL;
    if (S.panelSuite->GetPlatformWindow(S.panel, &pw) != 0 || !pw) return;
    RECT rc;
    if (!GetClientRect(pw, &rc)) return;
    MoveWindow(S.childWindow, 0, 0, rc.right - rc.left, rc.bottom - rc.top, TRUE);
}

static void WINAPI OnPanelSizeChanged(AIPanelRef panel) { (void)panel; FitDock(); }
static void WINAPI OnPanelStateChanged(AIPanelRef panel, short state) { (void)panel; (void)state; FitDock(); }

/* ---------------- 面板显示状态(跨启动记忆) ---------------- */
static void PanelStatePath(wchar_t *out, size_t cch)
{
    out[0] = 0;
    wchar_t base[MAX_PATH];
    if (FAILED(SHGetFolderPathW(NULL, CSIDL_LOCAL_APPDATA, NULL, 0, base))) return;
    _snwprintf(out, cch, L"%s\\YunLi\\panel-visible", base);
    out[cch - 1] = 0;
}

static BOOL LoadPanelVisible(void)
{
    wchar_t path[MAX_PATH];
    PanelStatePath(path, MAX_PATH);
    if (!path[0]) return FALSE;
    HANDLE h = CreateFileW(path, GENERIC_READ, FILE_SHARE_READ | FILE_SHARE_WRITE,
                           NULL, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, NULL);
    if (h == INVALID_HANDLE_VALUE) return FALSE;
    char c = 0;
    DWORD read = 0;
    ReadFile(h, &c, 1, &read, NULL);
    CloseHandle(h);
    return read == 1 && c == '1';
}

static void SavePanelVisible(int visible)
{
    wchar_t path[MAX_PATH];
    PanelStatePath(path, MAX_PATH);
    if (!path[0]) return;
    wchar_t dir[MAX_PATH];
    lstrcpynW(dir, path, MAX_PATH);
    wchar_t *slash = wcsrchr(dir, L'\\');
    if (slash) *slash = 0;
    CreateDirectoryW(dir, NULL);
    HANDLE h = CreateFileW(path, GENERIC_WRITE, 0, NULL, CREATE_ALWAYS,
                           FILE_ATTRIBUTE_NORMAL, NULL);
    if (h == INVALID_HANDLE_VALUE) return;
    char c = visible ? '1' : '0';
    DWORD written = 0;
    WriteFile(h, &c, 1, &written, NULL);
    CloseHandle(h);
}

/* ---------------- 快捷键(仅 Illustrator 前台生效) ---------------- */
static BOOL IsIllustratorForeground(void)
{
    HWND fg = GetForegroundWindow();
    if (!fg) return FALSE;
    DWORD pid = 0;
    GetWindowThreadProcessId(fg, &pid);
    return pid == GetCurrentProcessId();
}

static void DockChild(void);
static void TryDock(void);
static void BeginDock(void);
static void BeginReload(void);
static void TryFinishReload(void);
static BOOL StartPayload(void);
static SPErr ShowPanel(void);
static void WINAPI OnPanelVisibilityChanged(AIPanelRef panel, int visible);
static void WINAPI OnPanelClosed(AIPanelRef panel);

static LRESULT CALLBACK HiddenWndProc(HWND hwnd, UINT msg, WPARAM wp, LPARAM lp)
{
    if (msg == WM_YUNLI_SHOW) { ShowPanel(); return 0; }
    if (msg == WM_YUNLI_RELOAD) { BeginReload(); return 0; }
    if (msg == WM_TIMER && wp == DOCK_TIMER_ID) { TryDock(); return 0; }
    if (msg == WM_TIMER && wp == REFIT_TIMER_ID) {
        KillTimer(hwnd, REFIT_TIMER_ID);
        FitDock();
        return 0;
    }
    if (msg == WM_TIMER && wp == RELOAD_TIMER_ID) { TryFinishReload(); return 0; }
    if (msg == WM_COPYDATA && lp) {
        if (!S.nativeHandleCopyData) LoadNativeModule();
        if (S.nativeHandleCopyData) {
            return S.nativeHandleCopyData((const COPYDATASTRUCT *)lp) ? TRUE : FALSE;
        }
        return FALSE;
    }
    return DefWindowProcW(hwnd, msg, wp, lp);
}

static BOOL EnsureMessageWindow(void)
{
    if (S.msgWnd) return TRUE;
    static const wchar_t *kClass = L"YunLiMessageWindow";
    WNDCLASSEXW wc;
    ZeroMemory(&wc, sizeof(wc));
    wc.cbSize = sizeof(wc);
    wc.lpfnWndProc = HiddenWndProc;
    wc.hInstance = S.hSelf;
    wc.lpszClassName = kClass;
    RegisterClassExW(&wc);
    S.msgWnd = CreateWindowExW(0, kClass, L"", 0, 0, 0, 0, 0,
                               HWND_MESSAGE, NULL, S.hSelf, NULL);
    Log("message-window", S.msgWnd ? 0 : GetLastError());
    return S.msgWnd != NULL;
}

static LRESULT CALLBACK LowLevelKeyboardProc(int code, WPARAM wp, LPARAM lp)
{
    if (code == HC_ACTION && (wp == WM_KEYDOWN || wp == WM_SYSKEYDOWN)) {
        KBDLLHOOKSTRUCT *kb = (KBDLLHOOKSTRUCT *)lp;
        if (kb->vkCode == 'Y'
            && (GetAsyncKeyState(VK_CONTROL) & 0x8000)
            && (GetAsyncKeyState(VK_MENU) & 0x8000)
            && (GetAsyncKeyState(VK_SHIFT) & 0x8000)
            && IsIllustratorForeground()) {
            if (S.msgWnd) PostMessageW(S.msgWnd, WM_YUNLI_SHOW, 0, 0);
            return 1;   /* 只吞掉 Illustrator 前台时的组合键 */
        }
    }
    return CallNextHookEx(S.keyboardHook, code, wp, lp);
}

static void InstallShortcut(void)
{
    if (S.keyboardHook) return;
    S.keyboardHook = SetWindowsHookExW(WH_KEYBOARD_LL, LowLevelKeyboardProc, S.hSelf, 0);
    Log("shortcut-hook", S.keyboardHook ? 0 : GetLastError());
}

/* ---------------- 载荷进程、热重载与停靠 ---------------- */
static void CloseChildHandles(void)
{
    if (S.childProcess) { CloseHandle(S.childProcess); S.childProcess = NULL; }
    if (S.childThread)  { CloseHandle(S.childThread);  S.childThread = NULL; }
    S.childPid = 0;
}

static BOOL StartPayload(void)
{
    if (S.childProcess) return TRUE;
    wchar_t exe[MAX_PATH];
    int isHot = 0;
    if (!ResolvePayloadFile(PAYLOAD_EXE, 101, exe, MAX_PATH, &isHot)) {
        Log("no-payload", 0);
        return FALSE;
    }
    wchar_t host[MAX_PATH];
    GetModuleFileNameW(NULL, host, MAX_PATH);   /* 宿主 = Illustrator.exe */
    wchar_t aipFile[MAX_PATH];
    wchar_t aip[MAX_PATH];
    wchar_t cmd[MAX_PATH * 6];
    GetModuleFileNameW(S.hSelf, aipFile, MAX_PATH); /* 本 .aip 自身路径(在线更新替换用) */
    wcsncpy(aip, aipFile, MAX_PATH - 1);
    aip[MAX_PATH - 1] = 0;
    wchar_t *cut = wcsrchr(aip, L'\\');
    if (cut) *cut = 0;
    EnsureMessageWindow();
    _snwprintf(cmd, MAX_PATH * 6,
               L"\"%s\" --parent %lu --host \"%s\" --aidir \"%s\" --aip \"%s\" --ipc %llu --shell-ver %d",
               exe, (unsigned long)GetCurrentProcessId(), host, aip, aipFile,
               (unsigned long long)(uintptr_t)S.msgWnd, YUNLI_SHELL_VERSION);
    cmd[MAX_PATH * 6 - 1] = 0;

    STARTUPINFOW si;
    PROCESS_INFORMATION pi;
    ZeroMemory(&si, sizeof(si));
    ZeroMemory(&pi, sizeof(pi));
    si.cb = sizeof(si);
    if (!CreateProcessW(NULL, cmd, NULL, NULL, FALSE, 0, NULL, NULL, &si, &pi)) {
        Log("create-panel", GetLastError());
        if (isHot && !S.rollbackAttempted) {
            S.rollbackAttempted = 1;
            RollbackHotVersion();
            LoadNativeModule();
            return StartPayload();
        }
        return FALSE;
    }
    S.childProcess = pi.hProcess;
    S.childThread = pi.hThread;
    S.childPid = pi.dwProcessId;
    S.usingHot = isHot;
    Log("payload-started", isHot);
    return TRUE;
}

static void BeginReload(void)
{
    if (S.shuttingDown || S.reloading) return;
    S.reloading = 1;
    S.reloadTries = 0;
    S.rollbackAttempted = 0;
    if (S.msgWnd) {
        KillTimer(S.msgWnd, DOCK_TIMER_ID);
        KillTimer(S.msgWnd, REFIT_TIMER_ID);
    }
    if (S.childWindow) {
        SetParent(S.childWindow, NULL);
        ShowWindow(S.childWindow, SW_HIDE);
        S.childWindow = NULL;
    }
    Log("hot-reload-begin", 0);
    if (S.msgWnd) SetTimer(S.msgWnd, RELOAD_TIMER_ID, 100, NULL);
    else TryFinishReload();
}

static void TryFinishReload(void)
{
    if (S.shuttingDown) return;
    if (S.childProcess) {
        if (WaitForSingleObject(S.childProcess, 0) != WAIT_OBJECT_0) {
            if (++S.reloadTries < 50) return; /* 最多等 5 秒让旧核心优雅退出 */
            TerminateProcess(S.childProcess, 0);
            WaitForSingleObject(S.childProcess, 1000);
        }
        CloseChildHandles();
    }
    if (S.msgWnd) KillTimer(S.msgWnd, RELOAD_TIMER_ID);
    S.reloading = 0;

    LoadNativeModule();
    if (S.panel && S.panelSuite) {
        if (!S.panelWindow) S.panelSuite->GetPlatformWindow(S.panel, &S.panelWindow);
        if (StartPayload()) BeginDock();
    }
    Log("hot-reload-done", S.usingHot);
}

static void DockChild(void)
{
    struct FindChildCtx ctx;
    ctx.pid = S.childPid;
    ctx.hwnd = NULL;
    EnumWindows(FindChildProc, (LPARAM)&ctx);
    if (!ctx.hwnd || !S.panelWindow) return;
    S.childWindow = ctx.hwnd;
    LONG_PTR style = GetWindowLongPtrW(S.childWindow, GWL_STYLE);
    SetWindowLongPtrW(S.childWindow, GWL_STYLE,
                      (style & ~(WS_POPUP | WS_CAPTION | WS_THICKFRAME)) | WS_CHILD);
    SetParent(S.childWindow, S.panelWindow);
    FitDock();
    S.rollbackAttempted = 0;
    if (S.msgWnd) SetTimer(S.msgWnd, REFIT_TIMER_ID, 250, NULL);
    Log("dock-show", S.usingHot);
}

static void RollbackAndRestart(const char *reason)
{
    Log(reason, S.usingHot);
    if (S.childProcess) {
        if (WaitForSingleObject(S.childProcess, 0) != WAIT_OBJECT_0) {
            TerminateProcess(S.childProcess, 0);
            WaitForSingleObject(S.childProcess, 1000);
        }
        CloseChildHandles();
    }
    S.childWindow = NULL;
    if (S.usingHot && !S.rollbackAttempted) {
        S.rollbackAttempted = 1;
        RollbackHotVersion();
        LoadNativeModule();
        if (StartPayload()) {
            S.dockTries = 0;
            return;
        }
    }
    if (S.msgWnd) KillTimer(S.msgWnd, DOCK_TIMER_ID);
}

static void TryDock(void)
{
    if (!S.childWindow && S.childPid) {
        if (S.childProcess && WaitForSingleObject(S.childProcess, 0) == WAIT_OBJECT_0) {
            RollbackAndRestart("hot-child-crashed");
            return;
        }
        DockChild();
        if (S.childWindow) {
            if (S.msgWnd) KillTimer(S.msgWnd, DOCK_TIMER_ID);
            return;
        }
    } else if (S.childWindow) {
        FitDock();
        if (S.msgWnd) KillTimer(S.msgWnd, DOCK_TIMER_ID);
        return;
    }
    if (++S.dockTries > 100) {
        RollbackAndRestart("dock-window-timeout");
    }
}

static void BeginDock(void)
{
    if (!S.msgWnd) { DockChild(); return; }
    S.dockTries = 0;
    SetTimer(S.msgWnd, DOCK_TIMER_ID, 100, NULL);
}

/* ---------------- 面板 ---------------- */
static SPErr EnsurePanel(void)
{
    if (S.panel) return kNoErr;
    UStr id = {0}, title = {0};
    S.ustr->InitializeUTF16(&id, (const unsigned short *)PANEL_ID_W,
                            (int)wcslen(PANEL_ID_W));
    S.ustr->InitializeUTF16(&title, (const unsigned short *)PANEL_TITLE_W,
                            (int)wcslen(PANEL_TITLE_W));
    struct AISize minSize = { 272.0, 400.0 };
    SPErr err = S.panelSuite->Create(S.self, &id, &title, 1, &minSize, 1,
                                     NULL, NULL, &S.panel);
    S.ustr->Destroy(&id);
    S.ustr->Destroy(&title);
    if (err) { Log("create-panel", err); return err; }

    /* 首次停靠的默认尺寸(浮动/停靠两种形态共用),用户拖动后由 AI 工作区记忆 */
    struct AISize preferred = { 348.0, 648.0 };
    S.panelSuite->SetMinimumSize(S.panel, &minSize);
    S.panelSuite->SetPreferredSizes(S.panel, &preferred);
    S.panelSuite->SetSizeChangedNotifyProc(S.panel, OnPanelSizeChanged);
    S.panelSuite->SetStateChangedNotifyProc(S.panel, OnPanelStateChanged);
    S.panelSuite->SetVisibilityChangedNotifyProc(S.panel, OnPanelVisibilityChanged);
    S.panelSuite->SetClosedNotifyProc(S.panel, OnPanelClosed);
    SPErr iconErr = S.panelSuite->SetSVGIconResourceID(S.panel, PANEL_ICON_LIGHT, PANEL_ICON_DARK);
    Log("panel-icon", iconErr);
    Log("panel-created", 0);
    return kNoErr;
}

static SPErr ShowPanel(void)
{
    SPErr err = EnsurePanel();
    if (err) return err;
    /* 核心进程异常退出后,再次显示面板应当重新拉起。 */
    if (!S.reloading && S.childProcess && WaitForSingleObject(S.childProcess, 0) == WAIT_OBJECT_0) {
        CloseChildHandles();
        S.childWindow = NULL;
    }
    S.panelSuite->Show(S.panel, 1);
    if (!S.panelWindow) S.panelSuite->GetPlatformWindow(S.panel, &S.panelWindow);
    if (!S.reloading && !S.childWindow) {
        if (!S.childProcess && !StartPayload()) return kMissingSuiteErr;
        BeginDock();
    } else if (S.childWindow) {
        FitDock();
    }
    return kNoErr;
}

static void WINAPI OnPanelVisibilityChanged(AIPanelRef panel, int visible)
{
    (void)panel;
    if (S.shuttingDown || !visible) return;
    SavePanelVisible(1);
    /* 工作区恢复出面板时不经过菜单,这里补启动核心并停靠。 */
    if (!S.panelWindow) S.panelSuite->GetPlatformWindow(S.panel, &S.panelWindow);
    if (!S.reloading && !S.childWindow && !S.childProcess && StartPayload()) BeginDock();
    else if (S.childWindow) {
        FitDock();
        if (S.msgWnd) SetTimer(S.msgWnd, REFIT_TIMER_ID, 200, NULL);
    }
}

static void WINAPI OnPanelClosed(AIPanelRef panel)
{
    (void)panel;
    if (S.shuttingDown) return;
    SavePanelVisible(0);
}

/* ---------------- 清理 ---------------- */
static void Cleanup(void)
{
    S.shuttingDown = 1;
    UnloadNativeModule();
    if (S.msgWnd) {
        KillTimer(S.msgWnd, DOCK_TIMER_ID);
        KillTimer(S.msgWnd, REFIT_TIMER_ID);
        KillTimer(S.msgWnd, RELOAD_TIMER_ID);
        DestroyWindow(S.msgWnd);
        S.msgWnd = NULL;
    }
    if (S.keyboardHook) {
        UnhookWindowsHookEx(S.keyboardHook);
        S.keyboardHook = NULL;
    }
    if (S.childWindow) {
        SetParent(S.childWindow, NULL);
        ShowWindow(S.childWindow, SW_HIDE);
        S.childWindow = NULL;
    }
    if (S.childProcess) {
        TerminateProcess(S.childProcess, 0);
        CloseChildHandles();
    }
    if (S.panel && S.panelSuite) {
        S.panelSuite->Destroy(S.panel);
        S.panel = NULL;
        S.panelWindow = NULL;
    }
    Log("dock-shutdown-notifier", 0);
}

/* ---------------- 消息分发 ---------------- */
__declspec(dllexport) SPErr __cdecl PluginMain(char *caller, char *selector,
                                               void *message)
{
    if (!caller || !selector || !message) return kMissingBasicErr;

    if (lstrcmpA(caller, kCallerSP) == 0) {
        struct SPInterfaceMessage *m = (struct SPInterfaceMessage *)message;
        if (lstrcmpA(selector, kSelStartup) == 0) {
            if (!m->d.basic) { Log("missing-basic", 0); return kMissingBasicErr; }
            S.basic = m->d.basic;
            S.self = m->d.self;
            m->d.globals = &S;              /* 宿主回传的全局槽 */
            SPErr err = AcquireAll();
            if (err) return err;
            LoadNativeModule();
            err = RegisterMenu();
            if (err) return err;
            SPErr ne1 = S.notifierSuite->AddNotifier(S.self, NOTIFIER_SHUTDOWN,
                                                     kNotifShutdown, &S.notifShutdown);
            SPErr ne2 = S.notifierSuite->AddNotifier(S.self, NOTIFIER_SELECTION,
                                                     kNotifSelChanged, &S.notifSelChanged);
            SPErr ne3 = S.notifierSuite->AddNotifier(S.self, NOTIFIER_PROPERTIES,
                                                     kNotifPropChanged, &S.notifPropChanged);
            SPErr ne4 = S.notifierSuite->AddNotifier(S.self, NOTIFIER_DOCUMENT,
                                                     kNotifDocChanged, &S.notifDocChanged);
            Log("notif-shutdown", ne1);
            Log("notif-selection", ne2);
            Log("notif-properties", ne3);
            Log("notif-document", ne4);
            /* 启动时就建面板,AI 工作区才能恢复停靠图标;是否显示按上次状态。 */
            EnsureMessageWindow();
            InstallShortcut();
            if (EnsurePanel() == kNoErr && LoadPanelVisible()) {
                ShowPanel();
            }
            Log("startup-ready", YUNLI_SHELL_VERSION);
            return kNoErr;
        }
        if (lstrcmpA(selector, kSelShutdown) == 0) {
            Cleanup();
            return kNoErr;
        }
        return kNoErr;
    }

    if (lstrcmpA(caller, kCallerMenu) == 0) {
        struct AIMenuMessage *m = (struct AIMenuMessage *)message;
        if (lstrcmpA(selector, kSelMenuGo) == 0 && m->menuItem == S.menuItem) {
            return ShowPanel();
        }
        return kNoErr;                      /* "AI Update" 等暂不处理 */
    }

    if (lstrcmpA(caller, kCallerNotifier) == 0 && lstrcmpA(selector, kSelNotify) == 0) {
        struct AINotifierMessage *m = (struct AINotifierMessage *)message;
        if (m->isParallelDispatch) return kNoErr;
        if ((S.notifShutdown && m->notifier == S.notifShutdown) ||
            (m->type && lstrcmpA(m->type, kNotifShutdown) == 0)) {
            Cleanup();
        } else if ((S.notifSelChanged && m->notifier == S.notifSelChanged) ||
                   (S.notifPropChanged && m->notifier == S.notifPropChanged) ||
                   (S.notifDocChanged && m->notifier == S.notifDocChanged) ||
                   (m->type && (lstrcmpA(m->type, kNotifSelChanged) == 0 ||
                                lstrcmpA(m->type, kNotifPropChanged) == 0 ||
                                lstrcmpA(m->type, kNotifDocChanged) == 0))) {
            if (!S.shuttingDown && S.childWindow && IsWindow(S.childWindow)) {
                PostMessageW(S.childWindow, WM_YUNLI_SEL_CHANGED, 0, 0);
            }
        }
        return kNoErr;
    }
    return kNoErr;
}

/* ---------------- 保存本 DLL 句柄 ---------------- */
BOOL WINAPI DllMain(HINSTANCE hinstDLL, DWORD fdwReason, LPVOID lpvReserved)
{
    (void)lpvReserved;
    if (fdwReason == DLL_PROCESS_ATTACH) S.hSelf = hinstDLL;
    return TRUE;
}
