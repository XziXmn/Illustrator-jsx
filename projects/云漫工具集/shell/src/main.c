/* =========================================================================
 * 云漫工具集 Illustrator 插件壳 (YunLiTools.aip)
 *
 * 职责(对齐 字醒/ZiXing 的已验证架构,类型布局全部核对官方 AI 2027 SDK 头文件):
 *   1. PIPL 声明的 PluginMain(caller, selector, message) 字符串消息分发
 *   2. "SP Interface"/"Startup": AcquireSuite 取套件, 注册「窗口→YunLi工具箱」
 *      菜单项, 注册应用退出通知
 *   3. "AI Menu"/"AI Go": 已有面板则 Show;否则创建 AIPanel + 启动载荷进程
 *      (开发: payload\YunLiCore.exe 直启 / 发布: 资源 10/101 解包),
 *      EnumWindows 找到子进程主窗口后 SetParent 嵌入面板
 *   4. 面板尺寸变化回调同步子窗口尺寸; 退出通知/Shutdown 清理
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
#include <wchar.h>
#include <string.h>
#include <stdio.h>

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
struct AINotifierMessage  { SPMessageData d; void *notifier; };

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

struct AIPanelSuite {                     /* v4 */
    SPErr (*Create)(SPPluginRef self, UStr *inID, UStr *inTitle,
                    short inStateCount, struct AISize *inMinSize, int isResizable,
                    void *inFlyoutMenu, void *inUserData, AIPanelRef *outPanel);
    SPErr (*Destroy)(AIPanelRef inPanel);                          /* slot1 */
    SPErr (*GetPlatformWindow)(AIPanelRef inPanel, HWND *out);     /* slot2 */
    SPErr (*Show)(AIPanelRef inPanel, int inShow);                 /* slot3 */
    void *pad4_12[9];                                              /* slot4..12 */
    SPErr (*SetMinimumSize)(AIPanelRef inPanel, struct AISize *s); /* slot13 */
    void *pad14_16[3];                                             /* slot14..16 */
    SPErr (*SetPreferredSizes)(AIPanelRef inPanel, struct AISize *s); /* slot17 */
    void *pad18_35[18];                                            /* slot18..35 */
    SPErr (*SetSizeChangedNotifyProc)(AIPanelRef, PanelSizeChangedProc);   /* slot36 */
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
static const char kNotifShutdown[]    = "AI Application Shutdown Notifier";
static const char kSuiteMenu[]        = "AI Menu Suite";
static const char kSuiteUString[]     = "AI Unicode String Suite";
static const char kSuitePanel[]       = "AI Panel Suite";
static const char kSuiteNotifier[]    = "AI Notifier Suite";

#define kNoErr            0
#define kMissingBasicErr  ((SPErr)0x5041524D)  /* 'MRAP', 沿用字醒错误风格 */
#define kMissingSuiteErr  ((SPErr)0x594D4553)  /* 'YMES' */

#define MENU_KEY          "YunLi.Tools.Panel"
#define MENU_GROUP        "Tool Palettes"          /* 窗口菜单分组 */
#define MENU_TEXT_W       L"YunLi工具箱"
#define PANEL_ID_W        L"YunLi.Panel"
#define PANEL_TITLE_W     L"YunLi工具箱"
#define CHILD_TITLE       L"YunLiPanel"            /* 核心进程窗体标题前缀 */
#define PAYLOAD_EXE       L"YunLiCore.exe"
#define PLUGIN_NAME_YM    "YunLi"

/* ---------------- 全局状态 ---------------- */
static struct {
    struct SPBasicSuite *basic;
    SPPluginRef self;
    AIMenuItemHandle menuItem;
    struct AIMenuSuite *menu;
    struct AIUnicodeStringSuite *ustr;
    struct AIPanelSuite *panelSuite;
    struct AINotifierSuite *notifierSuite;
    AIPanelRef panel;
    HWND panelWindow;
    HWND childWindow;
    HANDLE childProcess;
    HANDLE childThread;
    HMODULE hSelf;
} S;

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

/* ---------------- 载荷定位 ---------------- */
static BOOL FileExistsW(const wchar_t *p)
{
    DWORD a = GetFileAttributesW(p);
    return a != INVALID_FILE_ATTRIBUTES && !(a & FILE_ATTRIBUTE_DIRECTORY);
}

/* 开发模式: <aip目录>\payload\YunLiCore.exe 或 YUNLI_PAYLOAD_DIR */
static BOOL FindDevPayload(wchar_t *out, DWORD cch)
{
    char env[MAX_PATH];
    if (GetEnvironmentVariableA("YUNLI_PAYLOAD_DIR", env, MAX_PATH)) {
        wchar_t wenv[MAX_PATH];
        if (MultiByteToWideChar(CP_ACP, 0, env, -1, wenv, MAX_PATH) > 0) {
            _snwprintf(out, cch, L"%s\\%s", wenv, PAYLOAD_EXE);
            out[cch - 1] = 0;
            if (FileExistsW(out)) return TRUE;
        }
    }
    wchar_t aip[MAX_PATH];
    GetModuleFileNameW(S.hSelf, aip, MAX_PATH);   /* 本 DLL 自身路径 */
    wchar_t *slash = wcsrchr(aip, L'\\');
    if (slash) *slash = 0;
    _snwprintf(out, cch, L"%s\\payload\\%s", aip, PAYLOAD_EXE);
    out[cch - 1] = 0;
    return FileExistsW(out);
}

/* 发布模式: 资源 10/101 → %LOCALAPPDATA%\YunLi\<sha256>\YunLiCore.exe */
static BOOL ExtractPayload(wchar_t *out, DWORD cch)
{
    HRSRC r = FindResourceW(S.hSelf, MAKEINTRESOURCEW(101), MAKEINTRESOURCEW(10));
    if (!r) { Log("panel-resource", GetLastError()); return FALSE; }
    HGLOBAL g = LoadResource(S.hSelf, r);
    void *p = LockResource(g);
    DWORD size = SizeofResource(S.hSelf, r);
    if (!p || !size) { Log("panel-resource-data", GetLastError()); return FALSE; }

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
    if (!hex[0]) { Log("hash", GetLastError()); return FALSE; }

    wchar_t base[MAX_PATH];
    if (FAILED(SHGetFolderPathW(NULL, CSIDL_LOCAL_APPDATA, NULL, 0, base))) return FALSE;
    wchar_t dir[MAX_PATH];
    _snwprintf(dir, MAX_PATH, L"%s\\YunLi\\%s", base, hex);
    dir[MAX_PATH - 1] = 0;
    CreateDirectoryW(dir, NULL);

    wchar_t tmp[MAX_PATH], finalp[MAX_PATH];
    _snwprintf(tmp, MAX_PATH, L"%s\\%s.tmp", dir, PAYLOAD_EXE);
    _snwprintf(finalp, MAX_PATH, L"%s\\%s", dir, PAYLOAD_EXE);
    HANDLE f = CreateFileW(tmp, GENERIC_WRITE, 0, NULL, CREATE_ALWAYS,
                           FILE_ATTRIBUTE_NORMAL, NULL);
    if (f == INVALID_HANDLE_VALUE) { Log("write-panel", GetLastError()); return FALSE; }
    DWORD w = 0;
    BOOL ok = WriteFile(f, p, size, &w, NULL) && w == size;
    CloseHandle(f);
    if (!ok) { Log("write-panel", GetLastError()); return FALSE; }
    if (!MoveFileExW(tmp, finalp, MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH)) {
        Log("replace-panel", GetLastError()); return FALSE;
    }
    _snwprintf(out, cch, L"%s", finalp);
    out[cch - 1] = 0;
    Log("panel-created", 0);
    return TRUE;
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

static BOOL LaunchPayload(void)
{
    wchar_t exe[MAX_PATH];
    if (!FindDevPayload(exe, MAX_PATH) && !ExtractPayload(exe, MAX_PATH)) {
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
    _snwprintf(cmd, MAX_PATH * 6, L"\"%s\" --parent %lu --host \"%s\" --aidir \"%s\" --aip \"%s\"",
               exe, (unsigned long)GetCurrentProcessId(), host, aip, aipFile);
    cmd[MAX_PATH * 6 - 1] = 0;

    STARTUPINFOW si;
    PROCESS_INFORMATION pi;
    ZeroMemory(&si, sizeof(si));
    ZeroMemory(&pi, sizeof(pi));
    si.cb = sizeof(si);
    if (!CreateProcessW(NULL, cmd, NULL, NULL, FALSE, 0, NULL, NULL, &si, &pi)) {
        Log("create-panel", GetLastError());
        return FALSE;
    }
    S.childProcess = pi.hProcess;
    S.childThread = pi.hThread;

    struct FindChildCtx ctx;
    ctx.pid = pi.dwProcessId;
    ctx.hwnd = NULL;
    for (int i = 0; i < 100 && !ctx.hwnd; i++) {
        Sleep(100);
        EnumWindows(FindChildProc, (LPARAM)&ctx);
    }
    if (!ctx.hwnd) { Log("dock-window", 0); return FALSE; }
    S.childWindow = ctx.hwnd;

    LONG_PTR style = GetWindowLongPtrW(S.childWindow, GWL_STYLE);
    SetWindowLongPtrW(S.childWindow, GWL_STYLE,
                      (style & ~(WS_POPUP | WS_CAPTION | WS_THICKFRAME)) | WS_CHILD);
    SetParent(S.childWindow, S.panelWindow);
    FitDock();
    Log("dock-show", 0);
    return TRUE;
}

/* ---------------- 面板 ---------------- */
static SPErr ShowOrLaunch(void)
{
    if (S.panel && S.panelSuite) {
        S.panelSuite->Show(S.panel, 1);
        Log("dock-show", 0);
        if (S.childWindow) FitDock();
        return kNoErr;
    }
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
    S.panelSuite->Show(S.panel, 1);
    S.panelSuite->GetPlatformWindow(S.panel, &S.panelWindow);
    Log("panel-created", 0);

    if (!LaunchPayload()) {
        Log("launch-failed", 0);
        return kMissingSuiteErr;
    }
    return kNoErr;
}

/* ---------------- 清理 ---------------- */
static void Cleanup(void)
{
    if (S.childWindow) {
        SetParent(S.childWindow, NULL);
        ShowWindow(S.childWindow, SW_HIDE);
        S.childWindow = NULL;
    }
    if (S.childProcess) {
        TerminateProcess(S.childProcess, 0);
        CloseHandle(S.childProcess);
        if (S.childThread) CloseHandle(S.childThread);
        S.childProcess = S.childThread = NULL;
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
            err = RegisterMenu();
            if (err) return err;
            AINotifierHandle nh = NULL;
            S.notifierSuite->AddNotifier(S.self, PLUGIN_NAME_YM,
                                         kNotifShutdown, &nh);
            Log("startup-ready", 0);
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
            return ShowOrLaunch();
        }
        return kNoErr;                      /* "AI Update" 等暂不处理 */
    }

    if (lstrcmpA(caller, kCallerNotifier) == 0) {
        if (lstrcmpA(selector, kNotifShutdown) == 0) {
            Cleanup();
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
