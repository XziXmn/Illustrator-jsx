/* =========================================================================
 * YunLi 原生 Illustrator SDK 工具模块 (native_tools.c)
 *
 * 功能:
 *   1. splitInspect / splitRun:
 *      基于 AIRasterSuite 的 100% 原始像素级无损裁切(不重采样、保留原 DPI、
 *      透明通道、专色填充、叠印与混合模式), 并可按矩形刀线建独立剪切蒙版。
 *   2. spotSelectInspect / spotSelectRun:
 *      基于 AICustomColorSuite / AIPathStyleSuite / AIMatchingArtSuite 的
 *      极速专色百分比选区(等于 / 以下<= / 以上>=), 支持矢量与着色位图。
 *
 * 所有结构体与槽位索引均按 AI 2027 SDK 头文件精确核对, Windows x64 使用
 * #pragma pack(push, 8) 与官方 MSVC ABI 一致。
 * ========================================================================= */
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <math.h>
#include <wchar.h>

#include "native_tools.h"

#pragma pack(push, 8)

typedef int      SPErr;
typedef int      AIErr;
typedef int      AIBoolean;
typedef uint8_t  AIBool8;
typedef double   AIReal;
typedef float    AIFloat;
typedef void    *SPPluginRef;
typedef void    *AIArtHandle;
typedef void    *AILayerHandle;
typedef void    *AIDocumentHandle;
typedef void    *AIAppContextHandle;
typedef void    *AICustomColorHandle;
typedef void    *AIArtStyleHandle;
typedef void    *AIStyleParser;
typedef void    *AIParserPaintField;
typedef void    *AIPatternHandle;
typedef void    *AIGradientHandle;
typedef void   **AIMdMemoryHandle;

typedef struct { double pad[16]; } AIArtStylePaintDataBuf;

typedef struct { void *fImpl; } UStr;
typedef struct { void *fImpl; } AIColorSpaceObj;

typedef struct { AIReal h, v; } AIRealPoint;
typedef struct { AIReal left, top, right, bottom; } AIRealRect;
typedef struct { AIReal a, b, c, d, tx, ty; } AIRealMatrix;
typedef struct { int32_t left, top, right, bottom; } AIRect;

typedef struct {
    int32_t top, left, bottom, right, front, back;
} AISlice;

#define kMaxChannels 32
typedef struct {
    void    *data;
    AISlice  bounds;
    int32_t  rowBytes;
    int32_t  colBytes;
    int32_t  planeBytes;
    int16_t  channelInterleave[kMaxChannels];
} AITile;

typedef struct {
    uint16_t flags;
    AIRect   bounds;
    int32_t  byteWidth;
    int16_t  colorSpace;
    int16_t  bitsPerPixel;
    int16_t  originalColorSpace;
} AIRasterRecord;

typedef struct {
    AIRealPoint p, in, out;
    AIBoolean   corner;
} AIPathSegment;

typedef struct {
    int16_t type;
    int32_t whichAttr;
    int32_t attr;
} AIMatchingArtSpec;

/* AIColor / AIPathStyle (严格对齐 AIColor.h & AIPathStyle.h, pack 8) */
enum {
    kGrayColor = 0,
    kFourColor = 1,
    kPattern = 2,
    kCustomColor = 3,
    kGradient = 4,
    kThreeColor = 5,
    kNoneColor = 6,
    kAdvanceColor = 7
};

#define kCustomSpotColor         0x0001
#define kCustomRegistrationColor 0x0002

typedef struct { AIReal gray; } AIGrayColorStyle;
typedef struct { AIReal cyan, magenta, yellow, black; } AIFourColorStyle;
typedef struct { AIReal red, green, blue; } AIThreeColorStyle;
typedef struct { AIReal l, a, b; } AILabColorStyle;

typedef union {
    AIFourColorStyle  f;
    AIThreeColorStyle rgb;
    AIGrayColorStyle  gray;
    AILabColorStyle   lab;
} AICustomColorUnion;

typedef struct {
    int32_t            kind;
    AICustomColorUnion c;
    int16_t            flag;
} AICustomColor;

typedef struct {
    AICustomColorHandle color;
    AIReal              tint; /* 0 = 100% ink, 1 = 0% ink */
} AICustomColorStyle;

typedef struct {
    AIPatternHandle pattern;
    AIReal          shiftDist;
    AIReal          shiftAngle;
    AIRealPoint     scale;
    AIReal          rotate;
    AIBoolean       reflect;
    AIReal          reflectAngle;
    AIReal          shearAngle;
    AIReal          shearAxis;
    AIRealMatrix    transform;
} AIPatternStyle;

typedef struct {
    AIGradientHandle gradient;
    AIRealPoint      gradientOrigin;
    AIReal           gradientAngle;
    AIReal           gradientLength;
    AIRealMatrix     matrix;
    AIReal           hiliteAngle;
    AIReal           hiliteLength;
} AIGradientStyle;

typedef union {
    AIGrayColorStyle   g;
    AIFourColorStyle   f;
    AIThreeColorStyle  rgb;
    AICustomColorStyle c;
    AIPatternStyle     p;
    AIGradientStyle    b;
} AIColorUnion;

typedef struct {
    int32_t      kind;
    AIColorUnion c;
} AIColor;

typedef struct {
    AIColor   color;
    AIBoolean overprint;
} AIFillStyle;

typedef struct {
    int16_t length;
    AIFloat offset;
    AIFloat array[6];
} AIDashStyle;

typedef struct {
    AIColor     color;
    AIBoolean   overprint;
    AIReal      width;
    AIDashStyle dash;
    int32_t     cap;
    int32_t     join;
    AIReal      miterLimit;
} AIStrokeStyle;

typedef struct {
    AIBoolean     fillPaint;
    AIBoolean     strokePaint;
    AIFillStyle   fill;
    AIStrokeStyle stroke;
    AIBoolean     clip;
    AIBoolean     lockClip;
    AIBoolean     evenodd;
    AIReal        resolution;
} AIPathStyle;

/* AIPathStyleMap (严格对齐 AIColor.h & AIPathStyle.h, 供 GetCurrentPathStyle 使用) */
typedef struct { AIBoolean gray; } AIGrayColorStyleMap;
typedef struct { AIBoolean cyan, magenta, yellow, black; } AIFourColorStyleMap;
typedef struct { AIBoolean red, green, blue; } AIThreeColorStyleMap;
typedef struct { AIBoolean color, tint; } AICustomColorStyleMap;
typedef struct { AIBoolean fields[10]; } AIPatternStyleMap;
typedef struct { AIBoolean fields[7]; } AIGradientStyleMap;

typedef union {
    AIGrayColorStyleMap   g;
    AIFourColorStyleMap   f;
    AIThreeColorStyleMap  rgb;
    AICustomColorStyleMap c;
    AIPatternStyleMap     p;
    AIGradientStyleMap    b;
} AIColorUnionMap;

typedef struct {
    AIBoolean       kind;
    AIColorUnionMap c;
} AIColorMap;

typedef struct {
    AIColorMap color;
    AIBoolean  overprint;
} AIFillStyleMap;

typedef struct {
    AIBoolean length;
    AIBoolean offset;
    AIBoolean array[6];
} AIDashStyleMap;

typedef struct {
    AIColorMap     color;
    AIBoolean      overprint;
    AIBoolean      width;
    AIDashStyleMap dash;
    AIBoolean      cap;
    AIBoolean      join;
    AIBoolean      miterLimit;
} AIStrokeStyleMap;

typedef struct {
    AIBoolean        fillPaint;
    AIBoolean        strokePaint;
    AIFillStyleMap   fill;
    AIStrokeStyleMap stroke;
    AIBoolean        clip;
    AIBoolean        lockClip;
    AIBoolean        evenodd;
    AIBoolean        resolution;
} AIPathStyleMap;

/* 常量 (AIArt.h / AITypes.h / AIRasterTypes.h) */
enum {
    kAnyArt          = -1,
    kUnknownArt      = 0,
    kGroupArt        = 1,
    kPathArt         = 2,
    kCompoundPathArt = 3,
    kPlacedArt       = 7,
    kRasterArt       = 9,
    kPluginArt       = 10,
    kMeshArt         = 11,
    kTextFrameArt    = 12,
    kSymbolArt       = 13
};

enum {
    kVisitColorsDirectOnly  = 0x0004,
    kVisitColorsSolidOnly   = 0x0008,
    kVisitColorsFillsOnly   = 0x0010,
    kVisitColorsStrokesOnly = 0x0020,
    kVisitColorsReadOnly    = 0x0040,
    kVisitColorsInResultArt = 0x0080
};

#define kStyleHasCustomColors 0x0008u
#define kCanceledErr4cc       ((AIErr)0x53544F50) /* 'STOP' */

typedef void (*AIAdjustColorFunc)(AIColor *color, void *userData, AIErr *result, AIBoolean *altered);

enum {
    kPlaceDefault        = 0,
    kPlaceAbove          = 1,
    kPlaceBelow          = 2,
    kPlaceInsideOnTop    = 3,
    kPlaceInsideOnBottom = 4,
    kPlaceAboveAll       = 5,
    kPlaceBelowAll       = 6
};

#define kArtSelected             0x00000001
#define kArtLocked               0x00000002
#define kArtHidden               0x00000004
#define kArtFullySelected        0x00000008
#define kArtSelectedTopLevelGroups 0x00000040
#define kArtIsClipMask           0x00001000
#define kFirstBeforeSecond       1
#define kFirstAfterSecond        2
#define kVisibleBounds           0x0000
#define kNoStrokeBounds          0x0002
#define kExcludeGuideBounds      0x0040
#define kTransferStyle           (1U << 1)
#define kTransferOpacityMask     (1U << 2)
#define kColorSpaceHasAlpha      0x10

/* ---------------- SDK Suites (按脚本核对的精确槽位) ---------------- */

typedef struct {
    SPErr (*AcquireSuite)(const char *name, int version, const void **suite);
} SPBasicSuiteMin;

typedef struct {
    void *Initialize;                                              /* 0 */
    SPErr (*InitializeUTF16)(UStr *str, const uint16_t *u, size_t n); /* 1 */
    void *InitializeUTF32Char;                                     /* 2 */
    SPErr (*Destroy)(UStr *str);                                   /* 3 */
    void *pad4_37[34];                                             /* 4..37 */
    size_t (*UTF_16)(const UStr *str, const uint16_t **buf);       /* 38 */
} AIUnicodeStringSuiteEx;

typedef struct {
    void *GetPlatformAppWindow;                                    /* 0 */
    AIErr (*PushAppContext)(SPPluginRef plugin, AIAppContextHandle *ctx); /* 1 */
    AIErr (*PopAppContext)(AIAppContextHandle ctx);                /* 2 */
} AIAppContextSuiteMin;

typedef struct {
    AIErr (*SetUndoTextUS)(const UStr *undoText, const UStr *redoText); /* 0 */
} AIUndoSuiteMin;

typedef struct {
    void *pad0_18[19];                                             /* 0..18 */
    AIErr (*RedrawDocument)(void);                                 /* 19 */
    AIErr (*GetDocument)(AIDocumentHandle *doc);                   /* 20 */
} AIDocumentSuiteMin;

typedef struct {
    AIErr (*NewArt)(int16_t type, int16_t paintOrder, AIArtHandle prep, AIArtHandle *newArt); /* 0 */
    AIErr (*DisposeArt)(AIArtHandle art);                          /* 1 */
    AIErr (*ReorderArt)(AIArtHandle art, int16_t paintOrder, AIArtHandle prep); /* 2 */
    AIErr (*DuplicateArt)(AIArtHandle art, int16_t paintOrder, AIArtHandle prep, AIArtHandle *newArt); /* 3 */
    AIErr (*GetFirstArtOfLayer)(AILayerHandle layer, AIArtHandle *art); /* 4 */
    AIErr (*GetLayerOfArt)(AIArtHandle art, AILayerHandle *layer); /* 5 */
    AIErr (*GetArtType)(AIArtHandle art, short *type);             /* 6 */
    AIErr (*GetArtUserAttr)(AIArtHandle art, int32_t whichAttr, int32_t *attr); /* 7 */
    AIErr (*SetArtUserAttr)(AIArtHandle art, int32_t whichAttr, int32_t attr);  /* 8 */
    AIErr (*GetArtParent)(AIArtHandle art, AIArtHandle *parent);   /* 9 */
    AIErr (*GetArtFirstChild)(AIArtHandle art, AIArtHandle *child);/* 10 */
    AIErr (*GetArtSibling)(AIArtHandle art, AIArtHandle *sibling); /* 11 */
    void *GetArtPriorSibling;                                      /* 12 */
    AIErr (*GetArtBounds)(AIArtHandle art, AIRealRect *bounds);    /* 13 */
    AIErr (*SetArtBounds)(AIArtHandle art);                        /* 14 */
    void *pad15_16[2];                                             /* 15..16 */
    AIErr (*GetArtTransformBounds)(AIArtHandle art, AIRealMatrix *xform, int32_t flags, AIRealRect *bounds); /* 17 */
    void *pad18_19[2];                                             /* 18..19 */
    AIErr (*GetArtOrder)(AIArtHandle art1, AIArtHandle art2, short *order); /* 20 */
    void *pad21_34[14];                                            /* 21..34 */
    AIErr (*SetArtName)(AIArtHandle art, const UStr *name);        /* 35 */
    void *pad36_41[6];                                             /* 36..41 */
    AIErr (*TransferAttributes)(AIArtHandle src, AIArtHandle dst, uint32_t which); /* 42 */
} AIArtSuiteMin;

typedef struct {
    AIErr (*GetRasterInfo)(AIArtHandle raster, AIRasterRecord *info); /* 0 */
    AIErr (*SetRasterInfo)(AIArtHandle raster, AIRasterRecord *info); /* 1 */
    void *pad2_3[2];                                               /* 2..3 */
    AIErr (*GetRasterMatrix)(AIArtHandle raster, AIRealMatrix *matrix); /* 4 */
    AIErr (*SetRasterMatrix)(AIArtHandle raster, AIRealMatrix *matrix); /* 5 */
    AIErr (*GetRasterBoundingBox)(AIArtHandle raster, AIRealRect *bbox); /* 6 */
    AIErr (*SetRasterBoundingBox)(AIArtHandle raster, AIRealRect *bbox); /* 7 */
    AIErr (*GetRasterTile)(AIArtHandle raster, AISlice *artSlice, AITile *workTile, AISlice *workSlice); /* 8 */
    AIErr (*SetRasterTile)(AIArtHandle raster, AISlice *artSlice, AITile *workTile, AISlice *workSlice); /* 9 */
    void *pad10_20[11];                                            /* 10..20 */
    AIErr (*SetColorSpaceInfo)(AIArtHandle raster, const AIColorSpaceObj *cs); /* 21 */
    AIErr (*GetColorSpaceInfo)(AIArtHandle raster, AIColorSpaceObj *cs);       /* 22 */
    AIErr (*SetOverprint)(AIArtHandle raster, AIBoolean enable);   /* 23 */
    AIErr (*GetOverprint)(AIArtHandle raster, AIBoolean *status);  /* 24 */
    AIErr (*IsColorized)(AIArtHandle raster, AIBoolean *isCol, AIBoolean *isAdd); /* 25 */
} AIRasterSuiteMin;

typedef struct {
    AIErr (*GetPathSegmentCount)(AIArtHandle path, int16_t *count); /* 0 */
    AIErr (*SetPathSegmentCount)(AIArtHandle path, int16_t count);  /* 1 */
    void *GetPathSegments;                                         /* 2 */
    AIErr (*SetPathSegments)(AIArtHandle path, int16_t segNum, int16_t count, const AIPathSegment segs[]); /* 3 */
    void *pad4_5[2];                                               /* 4..5 */
    AIErr (*GetPathClosed)(AIArtHandle path, AIBoolean *closed);   /* 6 */
    AIErr (*SetPathClosed)(AIArtHandle path, AIBoolean closed);    /* 7 */
    AIErr (*GetPathGuide)(AIArtHandle path, AIBoolean *isGuide);   /* 8 */
} AIPathSuiteMin;

typedef struct {
    AIErr (*GetPathStyle)(AIArtHandle path, AIPathStyle *style, AIBoolean *outHasAdvFill); /* 0 */
    AIErr (*SetPathStyle)(AIArtHandle path, const AIPathStyle *style);                     /* 1 */
    AIErr (*GetCurrentPathStyle)(AIPathStyle *style, AIPathStyleMap *stylemap,
                                 void **advStrokeParams, AIBoolean *outHasAdvFill);        /* 2 */
    void *pad3_21[19];                                                                     /* 3..21 */
    AIErr (*AdjustObjectAIColors)(AIArtHandle art, AIAdjustColorFunc cb, void *clientData,
                                  uint16_t controlFlags, AIBoolean *madeReplacement);      /* 22 */
} AIPathStyleSuiteMin;

typedef struct {
    AIErr    (*GetStyledArt)(AIArtHandle art, AIArtHandle *styledArt);                     /* 0 */
    AIErr    (*GetArtStyle)(AIArtHandle art, AIArtStyleHandle *artStyle);                  /* 1 */
    void    *pad2_5[4];                                                                    /* 2..5 */
    AIErr    (*SetArtStyle)(AIArtHandle art, AIArtStyleHandle artStyle);                   /* 6 */
    void    *pad7_10[4];                                                                   /* 7..10 */
    AIErr    (*GetPaintAttributes)(AIArtStyleHandle artStyle, AIPathStyle *style,
                                   void *paintData);                                       /* 11 */
    void    *pad12_32[21];                                                                 /* 12..32 */
    uint32_t (*ExamineStyle)(AIArtStyleHandle artStyle, uint32_t checkFor);                /* 33 */
} AIArtStyleSuiteMin;

typedef struct {
    AIErr     (*NewParser)(AIStyleParser *parser);                                         /* 0 */
    AIErr     (*DisposeParser)(AIStyleParser parser);                                      /* 1 */
    AIErr     (*ParseStyle)(AIStyleParser parser, AIArtStyleHandle artStyle);              /* 2 */
    void     *MergeStyleIntoParser;                                                        /* 3 */
    AIBoolean (*IsStyleParseable)(AIStyleParser parser);                                   /* 4 */
    void     *pad5_6[2];                                                                   /* 5..6 */
    int32_t   (*CountPaintFields)(AIStyleParser parser);                                   /* 7 */
    void     *pad8_10[3];                                                                  /* 8..10 */
    AIErr     (*GetNthPaintField)(AIStyleParser parser, int32_t n, AIParserPaintField *pf);/* 11 */
    void     *pad12_40[29];                                                                /* 12..40 */
    AIBoolean (*IsFill)(AIParserPaintField pf);                                            /* 41 */
    AIBoolean (*IsStroke)(AIParserPaintField pf);                                          /* 42 */
    AIErr     (*GetFill)(AIParserPaintField pf, AIFillStyle *fill, void *paintData);       /* 43 */
    AIErr     (*GetStroke)(AIParserPaintField pf, AIStrokeStyle *stroke, void *paintData); /* 44 */
} AIArtStyleParserSuiteMin;

typedef struct {
    AIErr (*GetSelectedArt)(AIArtHandle ***matches, int32_t *numMatches); /* 0 */
    AIErr (*GetMatchingArt)(AIMatchingArtSpec *specs, int16_t numSpecs, AIArtHandle ***matches, int32_t *numMatches); /* 1 */
    void *pad2_6[5];                                               /* 2..6 */
    AIErr (*DeselectAll)(void);                                    /* 7 */
} AIMatchingArtSuiteMin;

typedef struct {
    void *MdMemoryNewHandle;                                       /* 0 */
    AIErr (*MdMemoryDisposeHandle)(AIMdMemoryHandle hMem);         /* 1 */
} AIMdMemorySuiteMin;

typedef struct {
    AIErr (*CountLayers)(int32_t *count);                          /* 0 */
    void *GetNthLayer;                                             /* 1 */
    AIErr (*GetCurrentLayer)(AILayerHandle *layer);                /* 2 */
    AIErr (*SetCurrentLayer)(AILayerHandle layer);                 /* 3 */
    void *pad4_5[2];                                               /* 4..5 */
    AIErr (*InsertLayer)(AILayerHandle layer, int16_t paintOrder, AILayerHandle *newLayer); /* 6 */
    void *DeleteLayer;                                             /* 7 */
    void *GetLayerTitle;                                           /* 8 */
    AIErr (*SetLayerTitle)(AILayerHandle layer, const UStr *title);/* 9 */
    void *pad10_11[2];                                             /* 10..11 */
    AIErr (*GetLayerVisible)(AILayerHandle layer, AIBoolean *vis); /* 12 */
    AIErr (*SetLayerVisible)(AILayerHandle layer, AIBoolean vis);  /* 13 */
    void *pad14_15[2];                                             /* 14..15 */
    AIErr (*GetLayerEditable)(AILayerHandle layer, AIBoolean *ed); /* 16 */
    AIErr (*SetLayerEditable)(AILayerHandle layer, AIBoolean ed);  /* 17 */
} AILayerSuiteMin;

typedef struct {
    AIErr (*GetGroupClipped)(AIArtHandle group, AIBoolean *clipped); /* 0 */
    AIErr (*SetGroupClipped)(AIArtHandle group, AIBoolean clipped);  /* 1 */
} AIGroupSuiteMin;

typedef struct {
    void *pad0_13[14];                                             /* 0..13 */
    AIErr (*DeleteColorSpace)(AIColorSpaceObj *cs);                /* 14 */
    void *pad15_16[2];                                             /* 15..16 */
    int32_t (*GetNumComponents)(const AIColorSpaceObj *cs);        /* 17 */
    int32_t (*GetNumColorComponents)(const AIColorSpaceObj *cs);   /* 18 */
    void *pad19_25[7];                                             /* 19..25 */
    AIErr (*GetNthColorant)(const AIColorSpaceObj *cs, int32_t n, UStr *name); /* 26 */
} AIColorSpaceSuiteMin;

typedef struct {
    void *pad0_1[2];                                               /* 0..1 */
    AIErr (*GetCustomColor)(AICustomColorHandle cc, AICustomColor *color); /* 2 */
    void *SetCustomColor;                                          /* 3 */
    AIErr (*GetCustomColorName)(AICustomColorHandle cc, UStr *name); /* 4 */
    void *SetCustomColorName;                                      /* 5 */
    AIErr (*CountCustomColors)(int32_t *count);                    /* 6 */
    AIErr (*GetNthCustomColor)(int32_t n, AICustomColorHandle *cc);/* 7 */
    AIErr (*GetCustomColorByName)(const UStr *name, AICustomColorHandle *cc); /* 8 */
} AICustomColorSuiteMin;

typedef struct {
    int32_t (*GetBlendingMode)(AIArtHandle art);                   /* 0 */
    AIErr   (*SetBlendingMode)(AIArtHandle art, int32_t mode);     /* 1 */
    AIReal  (*GetOpacity)(AIArtHandle art);                        /* 2 */
    AIErr   (*SetOpacity)(AIArtHandle art, AIReal opacity);        /* 3 */
} AIBlendStyleSuiteMin;

#pragma pack(pop)

/* ---------------- 全局套件缓存 ---------------- */
static struct {
    SPBasicSuiteMin       *basic;
    SPPluginRef            self;
    AIUnicodeStringSuiteEx *ustr;
    YunLiLogFn             log;
    int                    ready;
    AIAppContextSuiteMin  *ctx;
    AIUndoSuiteMin        *undo;
    AIDocumentSuiteMin    *doc;
    AIArtSuiteMin         *art;
    AIRasterSuiteMin      *raster;
    AIPathSuiteMin        *path;
    AIPathStyleSuiteMin   *style;
    AIMatchingArtSuiteMin *match;
    AIMdMemorySuiteMin    *mem;
    AILayerSuiteMin       *layer;
    AIGroupSuiteMin       *group;
    AIColorSpaceSuiteMin  *cs;
    AICustomColorSuiteMin *cc;
    AIBlendStyleSuiteMin      *blend;
    AIArtStyleSuiteMin        *artStyle;
    AIArtStyleParserSuiteMin  *styleParser;
} N;

YUNLI_NATIVE_API void __cdecl YunLiNativeInit(void *basicSuite, void *pluginSelf, void *unicodeSuite, YunLiLogFn logFn)
{
    memset(&N, 0, sizeof(N));
    N.basic = (SPBasicSuiteMin *)basicSuite;
    N.self  = (SPPluginRef)pluginSelf;
    N.ustr  = (AIUnicodeStringSuiteEx *)unicodeSuite;
    N.log   = logFn;
}

YUNLI_NATIVE_API void __cdecl YunLiNativeShutdown(void)
{
    memset(&N, 0, sizeof(N));
}

static const void *AcquireRange(const char *name, int maxVer, int minVer)
{
    if (!N.basic || !N.basic->AcquireSuite) return NULL;
    for (int v = maxVer; v >= minVer; v--) {
        const void *s = NULL;
        if (N.basic->AcquireSuite(name, v, &s) == 0 && s) return s;
    }
    if (N.log) N.log(name, -1);
    return NULL;
}

static int EnsureSuites(void)
{
    if (N.ready) return 1;
    if (!N.basic || !N.ustr) return 0;
    N.ctx   = (AIAppContextSuiteMin *) AcquireRange("AI Context Suite", 10, 8);
    N.undo  = (AIUndoSuiteMin *)       AcquireRange("AI Undo Suite", 12, 10);
    N.doc   = (AIDocumentSuiteMin *)   AcquireRange("AI Document Suite", 21, 16);
    N.art   = (AIArtSuiteMin *)        AcquireRange("AI Art Suite", 21, 16);
    N.raster= (AIRasterSuiteMin *)     AcquireRange("AI Raster Suite", 11, 10);
    N.path  = (AIPathSuiteMin *)       AcquireRange("AI Path Suite", 13, 11);
    N.style = (AIPathStyleSuiteMin *)  AcquireRange("AI Path Style Suite", 14, 12);
    N.match = (AIMatchingArtSuiteMin *)AcquireRange("AI Matching Art Suite", 7, 6);
    N.mem   = (AIMdMemorySuiteMin *)   AcquireRange("AI MdMemory Suite", 3, 3);
    N.layer = (AILayerSuiteMin *)      AcquireRange("AI Layer Suite", 13, 12);
    N.group = (AIGroupSuiteMin *)      AcquireRange("AI Group Suite", 5, 4);
    N.cs    = (AIColorSpaceSuiteMin *) AcquireRange("AI Color Space Suite", 7, 5);
    N.cc    = (AICustomColorSuiteMin *)AcquireRange("AI Custom Color Suite", 8, 6);
    N.blend = (AIBlendStyleSuiteMin *) AcquireRange("AI Blend Style Suite", 5, 4);
    N.artStyle = (AIArtStyleSuiteMin *)AcquireRange("AI Art Style Suite", 8, 6);
    N.styleParser = (AIArtStyleParserSuiteMin *)AcquireRange("AI Art Style Parser Suite", 9, 5);
    if (!N.doc || !N.art || !N.raster || !N.path || !N.style || !N.match || !N.mem || !N.layer || !N.group || !N.cc) {
        return 0;
    }
    N.ready = 1;
    return 1;
}

/* ---------------- 字符串与 JSON 工具 ---------------- */

typedef struct {
    char  *buf;
    size_t len;
    size_t cap;
} StrBuf;

static void SbGrow(StrBuf *sb, size_t need)
{
    if (sb->len + need + 1 <= sb->cap) return;
    size_t ncap = sb->cap ? sb->cap * 2 : 1024;
    while (ncap < sb->len + need + 1) ncap *= 2;
    char *nb = (char *)realloc(sb->buf, ncap);
    if (!nb) return;
    sb->buf = nb;
    sb->cap = ncap;
}

static void SbAppendN(StrBuf *sb, const char *s, size_t n)
{
    SbGrow(sb, n);
    if (!sb->buf) return;
    memcpy(sb->buf + sb->len, s, n);
    sb->len += n;
    sb->buf[sb->len] = '\0';
}

static void SbAppend(StrBuf *sb, const char *s)
{
    SbAppendN(sb, s, strlen(s));
}

static void SbAppendFmt(StrBuf *sb, const char *fmt, ...)
{
    char tmp[256];
    va_list ap;
    va_start(ap, fmt);
    int n = vsnprintf(tmp, sizeof(tmp), fmt, ap);
    va_end(ap);
    if (n > 0) SbAppendN(sb, tmp, (size_t)(n < (int)sizeof(tmp) ? n : (int)sizeof(tmp) - 1));
}

static void SbAppendJsonStr(StrBuf *sb, const char *utf8)
{
    SbAppendN(sb, "\"", 1);
    if (utf8) {
        for (const unsigned char *p = (const unsigned char *)utf8; *p; p++) {
            unsigned char c = *p;
            if (c == '"') SbAppendN(sb, "\\\"", 2);
            else if (c == '\\') SbAppendN(sb, "\\\\", 2);
            else if (c == '\n') SbAppendN(sb, "\\n", 2);
            else if (c == '\r') SbAppendN(sb, "\\r", 2);
            else if (c == '\t') SbAppendN(sb, "\\t", 2);
            else if (c < 0x20) SbAppendFmt(sb, "\\u%04x", (unsigned)c);
            else SbAppendN(sb, (const char *)p, 1);
        }
    }
    SbAppendN(sb, "\"", 1);
}

static int UStrToUtf8(const UStr *u, char *out, int outCap)
{
    if (!out || outCap <= 0) return 0;
    out[0] = '\0';
    if (!u || !u->fImpl || !N.ustr || !N.ustr->UTF_16) return 0;
    const uint16_t *wptr = NULL;
    size_t wlen = N.ustr->UTF_16(u, &wptr);
    if (!wptr || wlen == 0) return 0;
    int n = WideCharToMultiByte(CP_UTF8, 0, (const wchar_t *)wptr, (int)wlen, out, outCap - 1, NULL, NULL);
    if (n < 0) n = 0;
    out[n] = '\0';
    return n;
}

static int Utf8ToUStr(const char *utf8, UStr *out)
{
    out->fImpl = NULL;
    if (!utf8 || !N.ustr) return 0;
    int wlen = MultiByteToWideChar(CP_UTF8, 0, utf8, -1, NULL, 0);
    if (wlen <= 0) return 0;
    wchar_t *wb = (wchar_t *)malloc((size_t)wlen * sizeof(wchar_t));
    if (!wb) return 0;
    MultiByteToWideChar(CP_UTF8, 0, utf8, -1, wb, wlen);
    SPErr err = N.ustr->InitializeUTF16(out, (const uint16_t *)wb, (size_t)(wlen - 1));
    free(wb);
    return err == 0;
}

static char *ReadFileUtf8(const wchar_t *path)
{
    HANDLE h = CreateFileW(path, GENERIC_READ, FILE_SHARE_READ | FILE_SHARE_WRITE,
                           NULL, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, NULL);
    if (h == INVALID_HANDLE_VALUE) return NULL;
    DWORD sz = GetFileSize(h, NULL);
    if (sz == INVALID_FILE_SIZE || sz > 4 * 1024 * 1024) { CloseHandle(h); return NULL; }
    char *buf = (char *)malloc(sz + 1);
    if (!buf) { CloseHandle(h); return NULL; }
    DWORD rd = 0;
    BOOL ok = ReadFile(h, buf, sz, &rd, NULL);
    CloseHandle(h);
    if (!ok) { free(buf); return NULL; }
    buf[rd] = '\0';
    return buf;
}

static void WriteFileUtf8(const wchar_t *path, const char *data, size_t len)
{
    HANDLE h = CreateFileW(path, GENERIC_WRITE, 0, NULL, CREATE_ALWAYS,
                           FILE_ATTRIBUTE_NORMAL, NULL);
    if (h == INVALID_HANDLE_VALUE) return;
    DWORD wr = 0;
    WriteFile(h, data, (DWORD)len, &wr, NULL);
    CloseHandle(h);
}

/* 极简 JSON 字段提取(请求固定由 YunLiCore.exe 序列化为平面 JSON) */
static const char *JsonFindKey(const char *json, const char *key)
{
    char pat[128];
    snprintf(pat, sizeof(pat), "\"%s\"", key);
    const char *p = json;
    while (p && (p = strstr(p, pat)) != NULL) {
        const char *q = p + strlen(pat);
        while (*q == ' ' || *q == '\t' || *q == '\r' || *q == '\n') q++;
        if (*q == ':') {
            q++;
            while (*q == ' ' || *q == '\t' || *q == '\r' || *q == '\n') q++;
            return q;
        }
        p += strlen(pat);
    }
    return NULL;
}

static int JsonGetStr(const char *json, const char *key, char *out, int cap)
{
    out[0] = '\0';
    const char *p = JsonFindKey(json, key);
    if (!p || *p != '"') return 0;
    p++;
    int oi = 0;
    while (*p && *p != '"' && oi + 4 < cap) {
        if (*p == '\\' && p[1]) {
            p++;
            if (*p == 'n') out[oi++] = '\n';
            else if (*p == 'r') out[oi++] = '\r';
            else if (*p == 't') out[oi++] = '\t';
            else if (*p == 'u' && p[1] && p[2] && p[3] && p[4]) {
                char hex[5] = { p[1], p[2], p[3], p[4], 0 };
                wchar_t wc = (wchar_t)strtoul(hex, NULL, 16);
                int n = WideCharToMultiByte(CP_UTF8, 0, &wc, 1, out + oi, cap - oi - 1, NULL, NULL);
                if (n > 0) oi += n;
                p += 4;
            } else {
                out[oi++] = *p;
            }
            p++;
        } else {
            out[oi++] = *p++;
        }
    }
    out[oi] = '\0';
    return 1;
}

static double JsonGetNum(const char *json, const char *key, double defVal)
{
    const char *p = JsonFindKey(json, key);
    if (!p) return defVal;
    char *end = NULL;
    double v = strtod(p, &end);
    return (end && end != p) ? v : defVal;
}

static int JsonGetBool(const char *json, const char *key, int defVal)
{
    const char *p = JsonFindKey(json, key);
    if (!p) return defVal;
    if (strncmp(p, "true", 4) == 0) return 1;
    if (strncmp(p, "false", 5) == 0) return 0;
    return defVal;
}

/* ---------------- 图层与选区辅助 ---------------- */

typedef struct {
    AIArtHandle *items;
    int          count;
    int          cap;
} ArtVec;

static int ArtVecContains(const ArtVec *v, AIArtHandle h)
{
    for (int i = 0; i < v->count; i++) if (v->items[i] == h) return 1;
    return 0;
}

static void ArtVecPushUnique(ArtVec *v, AIArtHandle h)
{
    if (!h || ArtVecContains(v, h)) return;
    if (v->count >= v->cap) {
        int nc = v->cap ? v->cap * 2 : 64;
        AIArtHandle *ni = (AIArtHandle *)realloc(v->items, (size_t)nc * sizeof(AIArtHandle));
        if (!ni) return;
        v->items = ni;
        v->cap = nc;
    }
    v->items[v->count++] = h;
}

static void ArtVecFree(ArtVec *v)
{
    free(v->items);
    v->items = NULL;
    v->count = v->cap = 0;
}

static int IsArtVisibleAndUnlocked(AIArtHandle art)
{
    AILayerHandle layer = NULL;
    if (N.art->GetLayerOfArt(art, &layer) == 0 && layer) {
        AIBoolean vis = 1, ed = 1;
        if (N.layer->GetLayerVisible(layer, &vis) == 0 && !vis) return 0;
        if (N.layer->GetLayerEditable(layer, &ed) == 0 && !ed) return 0;
    }
    AIArtHandle cur = art;
    while (cur) {
        int32_t attr = 0;
        if (N.art->GetArtUserAttr(cur, kArtHidden | kArtLocked, &attr) == 0) {
            if (attr & (kArtHidden | kArtLocked)) return 0;
        }
        AIArtHandle par = NULL;
        if (N.art->GetArtParent(cur, &par) != 0 || par == cur) break;
        cur = par;
    }
    return 1;
}

static void CollectSelectedTree(AIArtHandle art, ArtVec *rasters, ArtVec *rects, int *placedCount)
{
    if (!art) return;
    short type = 0;
    if (N.art->GetArtType(art, &type) != 0) return;

    if (type == kRasterArt) {
        ArtVecPushUnique(rasters, art);
        return;
    }
    if (type == kPlacedArt) {
        (*placedCount)++;
        return;
    }
    if (type == kPathArt) {
        AIBoolean isGuide = 0, closed = 0;
        int32_t attr = 0;
        N.path->GetPathGuide(art, &isGuide);
        N.path->GetPathClosed(art, &closed);
        N.art->GetArtUserAttr(art, kArtIsClipMask, &attr);
        if (!isGuide && closed && !(attr & kArtIsClipMask)) {
            AIRealRect rb;
            if (N.art->GetArtTransformBounds(art, NULL, kVisibleBounds | kNoStrokeBounds, &rb) == 0) {
                if ((rb.right - rb.left) > 0.5 && (rb.top - rb.bottom) > 0.5) {
                    ArtVecPushUnique(rects, art);
                }
            }
        }
        return;
    }
    if (type == kGroupArt) {
        AIArtHandle child = NULL;
        if (N.art->GetArtFirstChild(art, &child) == 0) {
            while (child) {
                CollectSelectedTree(child, rasters, rects, placedCount);
                AIArtHandle next = NULL;
                if (N.art->GetArtSibling(child, &next) != 0) break;
                child = next;
            }
        }
    }
}

static int GatherSelectionForSplit(ArtVec *rasters, ArtVec *rects, int *placedCount)
{
    *placedCount = 0;
    AIArtHandle **matches = NULL;
    int32_t num = 0;
    if (N.match->GetSelectedArt(&matches, &num) != 0) return 0;
    if (matches && num > 0) {
        for (int32_t i = 0; i < num; i++) {
            CollectSelectedTree((*matches)[i], rasters, rects, placedCount);
        }
    }
    if (matches) N.mem->MdMemoryDisposeHandle((AIMdMemoryHandle)matches);
    return 1;
}

static int RectsIntersect(const AIRealRect *a, const AIRealRect *b)
{
    return !(a->right <= b->left || a->left >= b->right || a->top <= b->bottom || a->bottom >= b->top);
}

static const char *ColorSpaceLabel(int16_t cs, int16_t bpp)
{
    int base = cs & ~kColorSpaceHasAlpha;
    int alpha = (cs & kColorSpaceHasAlpha) != 0;
    if (base == 0 && bpp == 1) return alpha ? "1-bit 位图(透明)" : "1-bit 位图";
    if (base == 0) return alpha ? "灰度(带透明)" : "灰度";
    if (base == 1) return alpha ? "RGB(带透明)" : "RGB";
    if (base == 2) return alpha ? "CMYK(带透明)" : "CMYK";
    if (base == 4) return alpha ? "专色分色(带透明)" : "专色分色";
    if (base == 5) return alpha ? "多通道专色(带透明)" : "多通道专色";
    if (base == 6) return alpha ? "索引色(带透明)" : "索引色";
    return "位图";
}

/* 提取位图的专色名称(优先 PathStyle, 其次 ColorSpace colorants) */
static void GetRasterSpotInfo(AIArtHandle raster, char *spotOut, int spotCap, double *tintOut)
{
    spotOut[0] = '\0';
    *tintOut = 100.0;

    AIPathStyle st;
    AIBoolean hasAdv = 0;
    memset(&st, 0, sizeof(st));
    if (N.style->GetPathStyle(raster, &st, &hasAdv) == 0 && st.fillPaint && st.fill.color.kind == kCustomColor && st.fill.color.c.c.color) {
        UStr uname = {0};
        if (N.cc->GetCustomColorName(st.fill.color.c.c.color, &uname) == 0) {
            UStrToUtf8(&uname, spotOut, spotCap);
            N.ustr->Destroy(&uname);
        }
        *tintOut = (1.0 - st.fill.color.c.c.tint) * 100.0;
        if (*tintOut < 0.0) *tintOut = 0.0;
        if (*tintOut > 100.0) *tintOut = 100.0;
        if (spotOut[0]) return;
    }

    if (N.cs) {
        AIColorSpaceObj csObj = {0};
        if (N.raster->GetColorSpaceInfo(raster, &csObj) == 0 && csObj.fImpl) {
            int32_t nc = N.cs->GetNumColorComponents(&csObj);
            for (int32_t i = 0; i < nc; i++) {
                UStr cname = {0};
                if (N.cs->GetNthColorant(&csObj, i, &cname) == 0) {
                    char buf[256];
                    UStrToUtf8(&cname, buf, sizeof(buf));
                    N.ustr->Destroy(&cname);
                    if (buf[0] && strcmp(buf, "Gray") != 0 && strcmp(buf, "Black") != 0 &&
                        strcmp(buf, "Cyan") != 0 && strcmp(buf, "Magenta") != 0 && strcmp(buf, "Yellow") != 0 &&
                        strcmp(buf, "Red") != 0 && strcmp(buf, "Green") != 0 && strcmp(buf, "Blue") != 0) {
                        strncpy(spotOut, buf, (size_t)spotCap - 1);
                        spotOut[spotCap - 1] = '\0';
                        break;
                    }
                }
            }
            N.cs->DeleteColorSpace(&csObj);
        }
    }
}

/* ---------------- 命令 1: splitInspect ---------------- */

static void HandleSplitInspect(StrBuf *out)
{
    AIDocumentHandle docH = NULL;
    if (N.doc->GetDocument(&docH) != 0 || !docH) {
        SbAppend(out, "{\"ok\":false,\"error\":\"请先打开文档。\"}");
        return;
    }

    ArtVec rasters = {0}, rects = {0};
    int placed = 0;
    GatherSelectionForSplit(&rasters, &rects, &placed);

    SbAppend(out, "{\"ok\":true,\"data\":{");
    SbAppendFmt(out, "\"rasterCount\":%d,\"rectCount\":%d,\"placedCount\":%d", rasters.count, rects.count, placed);

    if (rasters.count == 1) {
        AIArtHandle r = rasters.items[0];
        AIRasterRecord rec;
        AIRealMatrix m;
        AIRealRect sb;
        memset(&rec, 0, sizeof(rec));
        memset(&m, 0, sizeof(m));
        memset(&sb, 0, sizeof(sb));
        N.raster->GetRasterInfo(r, &rec);
        N.raster->GetRasterMatrix(r, &m);
        N.art->GetArtBounds(r, &sb);

        int w = rec.bounds.right - rec.bounds.left;
        int h = rec.bounds.bottom - rec.bounds.top;
        double sx = hypot(m.a, m.b);
        double sy = hypot(m.c, m.d);
        double dpiX = sx > 1e-9 ? 72.0 / sx : 72.0;
        double dpiY = sy > 1e-9 ? 72.0 / sy : 72.0;

        int overlap = 0;
        for (int i = 0; i < rects.count; i++) {
            AIRealRect rb;
            if (N.art->GetArtTransformBounds(rects.items[i], NULL, kVisibleBounds | kNoStrokeBounds, &rb) == 0) {
                if (RectsIntersect(&rb, &sb)) overlap++;
            }
        }

        char spotName[256];
        double tint = 100.0;
        GetRasterSpotInfo(r, spotName, sizeof(spotName), &tint);

        SbAppendFmt(out, ",\"width\":%d,\"height\":%d,\"bitsPerPixel\":%d,\"hasAlpha\":%s,\"dpiX\":%.1f,\"dpiY\":%.1f,\"overlapCount\":%d",
            w, h, (int)rec.bitsPerPixel, (rec.colorSpace & kColorSpaceHasAlpha) ? "true" : "false",
            dpiX, dpiY, overlap);
        SbAppend(out, ",\"colorSpace\":");
        SbAppendJsonStr(out, ColorSpaceLabel(rec.colorSpace, rec.bitsPerPixel));
        SbAppend(out, ",\"spot\":");
        SbAppendJsonStr(out, spotName);
        SbAppendFmt(out, ",\"tint\":%.1f", tint);
    }

    SbAppend(out, "}}");
    ArtVecFree(&rasters);
    ArtVecFree(&rects);
}

/* ---------------- 命令 2: splitRun (原生像素级无损裁切) ---------------- */

static int CmpRectBounds(const void *pa, const void *pb)
{
    const AIRealRect *a = (const AIRealRect *)pa;
    const AIRealRect *b = (const AIRealRect *)pb;
    if (fabs(a->top - b->top) > 5.0) return (b->top > a->top) ? 1 : -1;
    if (a->left < b->left) return -1;
    if (a->left > b->left) return 1;
    return 0;
}

/* 按实际 ArtBounds 自校准矩阵 Y 符号 (+1 或 -1), 彻底消除坐标系歧义 */
static double CalibrateRasterYSign(const AIRealMatrix *m, int w, int h, const AIRealRect *artBounds)
{
    double errNeg = 0.0, errPos = 0.0;
    double signs[2] = { -1.0, 1.0 };
    for (int s = 0; s < 2; s++) {
        double ys = signs[s];
        double cx[4] = { 0, (double)w, (double)w, 0 };
        double cy[4] = { 0, 0, (double)h, (double)h };
        double minX = 1e30, maxX = -1e30, minY = 1e30, maxY = -1e30;
        for (int i = 0; i < 4; i++) {
            double x = m->a * cx[i] + m->c * (ys * cy[i]) + m->tx;
            double y = m->b * cx[i] + m->d * (ys * cy[i]) + m->ty;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        }
        double err = fabs(minX - artBounds->left) + fabs(maxX - artBounds->right)
                   + fabs(maxY - artBounds->top) + fabs(minY - artBounds->bottom);
        if (s == 0) errNeg = err; else errPos = err;
    }
    return (errNeg <= errPos) ? -1.0 : 1.0;
}

static AIErr CopyRasterRegionLossless(AIArtHandle srcArt, AIArtHandle dstArt,
                                      const AIRasterRecord *srcRec,
                                      int px0, int py0, int cropW, int cropH, int numChannels)
{
    const int STRIP = 256;

    if (srcRec->bitsPerPixel == 1) {
        /* 1-bit 位图按字节对齐读取再精确移位打包, 支持任意非 8 倍数 px0 */
        int alignedPx0 = px0 & ~7;
        int bitShift   = px0 & 7;
        int readW      = ((px0 + cropW + 7) & ~7) - alignedPx0;
        if (alignedPx0 + readW > srcRec->bounds.right) readW = srcRec->bounds.right - alignedPx0;
        int srcRowBytes = (readW + 7) / 8;
        int dstRowBytes = (cropW + 7) / 8;

        uint8_t *srcBuf = (uint8_t *)malloc((size_t)srcRowBytes * STRIP);
        uint8_t *dstBuf = (uint8_t *)malloc((size_t)dstRowBytes * STRIP);
        if (!srcBuf || !dstBuf) { free(srcBuf); free(dstBuf); return -1; }

        AIErr err = 0;
        for (int y = 0; y < cropH && err == 0; y += STRIP) {
            int sh = (y + STRIP <= cropH) ? STRIP : (cropH - y);

            AISlice sArt = { py0 + y, alignedPx0, py0 + y + sh, alignedPx0 + readW, 0, 1 };
            AISlice sWrk = { 0, 0, sh, readW, 0, 1 };
            AITile  tSrc;
            memset(&tSrc, 0, sizeof(tSrc));
            tSrc.data = srcBuf;
            tSrc.bounds = sWrk;
            tSrc.rowBytes = srcRowBytes;
            tSrc.colBytes = 0;
            tSrc.planeBytes = 0;
            tSrc.channelInterleave[0] = 0;

            err = N.raster->GetRasterTile(srcArt, &sArt, &tSrc, &sWrk);
            if (err != 0) break;

            memset(dstBuf, 0, (size_t)dstRowBytes * (size_t)sh);
            for (int r = 0; r < sh; r++) {
                const uint8_t *sr = srcBuf + (size_t)r * (size_t)srcRowBytes;
                uint8_t       *dr = dstBuf + (size_t)r * (size_t)dstRowBytes;
                if (bitShift == 0) {
                    memcpy(dr, sr, (size_t)dstRowBytes);
                } else {
                    for (int b = 0; b < dstRowBytes; b++) {
                        uint8_t hi = (uint8_t)(sr[b] << bitShift);
                        uint8_t lo = (b + 1 < srcRowBytes) ? (uint8_t)(sr[b + 1] >> (8 - bitShift)) : 0;
                        dr[b] = (uint8_t)(hi | lo);
                    }
                }
            }

            AISlice dArt = { y, 0, y + sh, cropW, 0, 1 };
            AISlice dWrk = { 0, 0, sh, cropW, 0, 1 };
            AITile  tDst;
            memset(&tDst, 0, sizeof(tDst));
            tDst.data = dstBuf;
            tDst.bounds = dWrk;
            tDst.rowBytes = dstRowBytes;
            tDst.colBytes = 0;
            tDst.planeBytes = 0;
            tDst.channelInterleave[0] = 0;

            err = N.raster->SetRasterTile(dstArt, &dArt, &tDst, &dWrk);
        }
        free(srcBuf);
        free(dstBuf);
        return err;
    }

    /* 8/16/24/32/40-bit 多通道位图原始字节无损搬运 */
    int bytesPerPixel = srcRec->bitsPerPixel / 8;
    if (bytesPerPixel <= 0) return -1;
    if (numChannels <= 0 || numChannels > kMaxChannels) numChannels = bytesPerPixel;
    int rowBytes = cropW * bytesPerPixel;
    uint8_t *buf = (uint8_t *)malloc((size_t)rowBytes * STRIP);
    if (!buf) return -1;

    AIErr err = 0;
    for (int y = 0; y < cropH && err == 0; y += STRIP) {
        int sh = (y + STRIP <= cropH) ? STRIP : (cropH - y);
        AISlice sArt = { py0 + y, px0, py0 + y + sh, px0 + cropW, 0, numChannels };
        AISlice dArt = { y, 0, y + sh, cropW, 0, numChannels };
        AISlice sWrk = { 0, 0, sh, cropW, 0, numChannels };
        AITile  tile;
        memset(&tile, 0, sizeof(tile));
        tile.data = buf;
        tile.bounds = sWrk;
        tile.rowBytes = rowBytes;
        tile.colBytes = bytesPerPixel;
        tile.planeBytes = 0;
        for (int c = 0; c < numChannels; c++) tile.channelInterleave[c] = (int16_t)c;

        err = N.raster->GetRasterTile(srcArt, &sArt, &tile, &sWrk);
        if (err != 0) break;
        err = N.raster->SetRasterTile(dstArt, &dArt, &tile, &sWrk);
    }
    free(buf);
    return err;
}

static void HandleSplitRun(const char *reqJson, StrBuf *out)
{
    DWORD t0 = GetTickCount();
    AIDocumentHandle docH = NULL;
    if (N.doc->GetDocument(&docH) != 0 || !docH) {
        SbAppend(out, "{\"ok\":false,\"error\":\"请先打开文档。\"}");
        return;
    }

    int padPx      = (int)JsonGetNum(reqJson, "padPx", 2.0);
    int applyMask  = JsonGetBool(reqJson, "applyMask", 1);
    int hideSource = JsonGetBool(reqJson, "hideSource", 1);
    int skipEmpty  = JsonGetBool(reqJson, "skipEmpty", 1);
    if (padPx < 0) padPx = 0;
    if (padPx > 64) padPx = 64;

    ArtVec rasters = {0}, rects = {0};
    int placed = 0;
    GatherSelectionForSplit(&rasters, &rects, &placed);

    if (rasters.count == 0) {
        if (placed > 0)
            SbAppend(out, "{\"ok\":false,\"error\":\"检测到选中的是外部链接图，请先在「链接」面板中嵌入后再试。\"}");
        else
            SbAppend(out, "{\"ok\":false,\"error\":\"未在选中对象中找到嵌入位图，请同时选中位图和矩形刀线框。\"}");
        ArtVecFree(&rasters); ArtVecFree(&rects);
        return;
    }
    if (rasters.count > 1) {
        SbAppend(out, "{\"ok\":false,\"error\":\"请只选中 1 张嵌入位图和对应的矩形刀线框。\"}");
        ArtVecFree(&rasters); ArtVecFree(&rects);
        return;
    }
    if (rects.count == 0) {
        SbAppend(out, "{\"ok\":false,\"error\":\"未在选中对象中找到闭合矩形刀线框。\"}");
        ArtVecFree(&rasters); ArtVecFree(&rects);
        return;
    }

    AIArtHandle srcArt = rasters.items[0];
    AIRasterRecord srcRec;
    AIRealMatrix srcMat;
    AIRealRect srcBounds;
    memset(&srcRec, 0, sizeof(srcRec));
    memset(&srcMat, 0, sizeof(srcMat));
    memset(&srcBounds, 0, sizeof(srcBounds));
    if (N.raster->GetRasterInfo(srcArt, &srcRec) != 0 ||
        N.raster->GetRasterMatrix(srcArt, &srcMat) != 0 ||
        N.art->GetArtBounds(srcArt, &srcBounds) != 0) {
        SbAppend(out, "{\"ok\":false,\"error\":\"无法读取原位图信息。\"}");
        ArtVecFree(&rasters); ArtVecFree(&rects);
        return;
    }

    int srcW = srcRec.bounds.right - srcRec.bounds.left;
    int srcH = srcRec.bounds.bottom - srcRec.bounds.top;
    if (srcW <= 0 || srcH <= 0) {
        SbAppend(out, "{\"ok\":false,\"error\":\"原位图像素尺寸无效。\"}");
        ArtVecFree(&rasters); ArtVecFree(&rects);
        return;
    }

    double det = srcMat.a * srcMat.d - srcMat.b * srcMat.c;
    if (fabs(det) < 1e-12) {
        SbAppend(out, "{\"ok\":false,\"error\":\"原位图变换矩阵不可逆。\"}");
        ArtVecFree(&rasters); ArtVecFree(&rects);
        return;
    }
    double ySign = CalibrateRasterYSign(&srcMat, srcW, srcH, &srcBounds);

    /* 提取并排序所有闭合矩形的几何边界(不含描边宽度) */
    AIRealRect *rlist = (AIRealRect *)malloc((size_t)rects.count * sizeof(AIRealRect));
    if (!rlist) {
        SbAppend(out, "{\"ok\":false,\"error\":\"内存不足。\"}");
        ArtVecFree(&rasters); ArtVecFree(&rects);
        return;
    }
    int rcount = 0;
    for (int i = 0; i < rects.count; i++) {
        AIRealRect rb;
        if (N.art->GetArtTransformBounds(rects.items[i], NULL, kVisibleBounds | kNoStrokeBounds, &rb) == 0) {
            rlist[rcount++] = rb;
        }
    }
    qsort(rlist, (size_t)rcount, sizeof(AIRealRect), CmpRectBounds);

    /* 读取原图的色彩空间、叠印、混合模式、不透明度与样式 */
    AIColorSpaceObj srcCS = {0};
    int hasCS = (N.cs && N.raster->GetColorSpaceInfo(srcArt, &srcCS) == 0 && srcCS.fImpl != NULL);
    int numChannels = (srcRec.bitsPerPixel == 1) ? 1 : (srcRec.bitsPerPixel / 8);
    if (hasCS) {
        int32_t comps = N.cs->GetNumComponents(&srcCS);
        if (comps > 0 && comps <= kMaxChannels) numChannels = comps;
    }

    AIBoolean srcOverprint = 0;
    int hasOverprint = (N.raster->GetOverprint(srcArt, &srcOverprint) == 0);
    int32_t srcBlendMode = 0;
    AIReal  srcOpacity   = 1.0;
    if (N.blend) {
        srcBlendMode = N.blend->GetBlendingMode(srcArt);
        srcOpacity   = N.blend->GetOpacity(srcArt);
    }

    char spotName[256];
    double tintPct = 100.0;
    GetRasterSpotInfo(srcArt, spotName, sizeof(spotName), &tintPct);

    /* 设置 Undo 文案 */
    if (N.undo) {
        UStr uUndo = {0}, uRedo = {0};
        if (Utf8ToUStr("撤销图片分切", &uUndo) && Utf8ToUStr("重做图片分切", &uRedo)) {
            N.undo->SetUndoTextUS(&uUndo, &uRedo);
        }
        if (uUndo.fImpl) N.ustr->Destroy(&uUndo);
        if (uRedo.fImpl) N.ustr->Destroy(&uRedo);
    }

    /* 创建顶部输出图层 */
    AILayerHandle outLayer = NULL;
    AIArtHandle   layerRoot = NULL;
    if (N.layer->InsertLayer(NULL, kPlaceAboveAll, &outLayer) != 0 || !outLayer) {
        if (hasCS) N.cs->DeleteColorSpace(&srcCS);
        free(rlist); ArtVecFree(&rasters); ArtVecFree(&rects);
        SbAppend(out, "{\"ok\":false,\"error\":\"无法新建输出图层。\"}");
        return;
    }
    char layerTitle[320];
    if (spotName[0]) snprintf(layerTitle, sizeof(layerTitle), "图片分切_%s", spotName);
    else snprintf(layerTitle, sizeof(layerTitle), "图片分切");
    UStr uTitle = {0};
    if (Utf8ToUStr(layerTitle, &uTitle)) {
        N.layer->SetLayerTitle(outLayer, &uTitle);
        N.ustr->Destroy(&uTitle);
    }
    N.layer->SetLayerVisible(outLayer, 1);
    N.layer->SetLayerEditable(outLayer, 1);
    N.art->GetFirstArtOfLayer(outLayer, &layerRoot);

    /* 无填充无描边的纯净蒙版路径样式 */
    AIPathStyle emptyStyle;
    memset(&emptyStyle, 0, sizeof(emptyStyle));
    emptyStyle.fillPaint = 0;
    emptyStyle.strokePaint = 0;
    emptyStyle.fill.color.kind = kNoneColor;
    emptyStyle.stroke.color.kind = kNoneColor;
    emptyStyle.resolution = 800.0;

    int created = 0, skipped = 0;
    AIErr lastErr = 0;

    for (int i = 0; i < rcount; i++) {
        AIRealRect rb = rlist[i];
        if (skipEmpty && !RectsIntersect(&rb, &srcBounds)) {
            skipped++;
            continue;
        }

        /* 4 个角反投影到源像素坐标 */
        double ax[4] = { rb.left, rb.right, rb.right, rb.left };
        double ay[4] = { rb.top,  rb.top,   rb.bottom, rb.bottom };
        double minPx = 1e30, maxPx = -1e30, minPy = 1e30, maxPy = -1e30;
        for (int k = 0; k < 4; k++) {
            double rx = ax[k] - srcMat.tx;
            double ry = ay[k] - srcMat.ty;
            double xLocal = ( srcMat.d * rx - srcMat.c * ry) / det;
            double yLocal = (-srcMat.b * rx + srcMat.a * ry) / det;
            double px = xLocal;
            double py = yLocal * ySign;
            if (px < minPx) minPx = px;
            if (px > maxPx) maxPx = px;
            if (py < minPy) minPy = py;
            if (py > maxPy) maxPy = py;
        }

        int usePad = applyMask ? padPx : 0;
        int px0 = (int)floor(minPx) - usePad;
        int py0 = (int)floor(minPy) - usePad;
        int px1 = (int)ceil(maxPx)  + usePad;
        int py1 = (int)ceil(maxPy)  + usePad;
        if (px0 < 0) px0 = 0;
        if (py0 < 0) py0 = 0;
        if (px1 > srcW) px1 = srcW;
        if (py1 > srcH) py1 = srcH;

        int cropW = px1 - px0;
        int cropH = py1 - py0;
        if (cropW <= 0 || cropH <= 0) {
            skipped++;
            continue;
        }

        AIArtHandle container = layerRoot;
        AIArtHandle grp = NULL;
        if (applyMask) {
            lastErr = N.art->NewArt(kGroupArt, kPlaceInsideOnBottom, layerRoot, &grp);
            if (lastErr != 0 || !grp) break;
            container = grp;
        }

        AIArtHandle dstArt = NULL;
        lastErr = N.art->NewArt(kRasterArt, kPlaceInsideOnBottom, container, &dstArt);
        if (lastErr != 0 || !dstArt) {
            if (grp) N.art->DisposeArt(grp);
            break;
        }

        AIRasterRecord dstRec = srcRec;
        dstRec.bounds.left   = 0;
        dstRec.bounds.top    = 0;
        dstRec.bounds.right  = cropW;
        dstRec.bounds.bottom = cropH;
        dstRec.byteWidth = (srcRec.bitsPerPixel == 1)
            ? ((cropW + 7) / 8)
            : (cropW * (srcRec.bitsPerPixel / 8));

        lastErr = N.raster->SetRasterInfo(dstArt, &dstRec);
        if (lastErr == 0 && hasCS) {
            N.raster->SetColorSpaceInfo(dstArt, &srcCS);
        }
        if (lastErr == 0) {
            lastErr = CopyRasterRegionLossless(srcArt, dstArt, &srcRec, px0, py0, cropW, cropH, numChannels);
        }
        if (lastErr != 0) {
            N.art->DisposeArt(grp ? grp : dstArt);
            break;
        }

        /* 精确平移矩阵: 本地像素 (0,0) -> 原图像素 (px0, py0) */
        AIRealMatrix dstMat = srcMat;
        double dx = (double)px0;
        double dy = ySign * (double)py0;
        dstMat.tx = srcMat.a * dx + srcMat.c * dy + srcMat.tx;
        dstMat.ty = srcMat.b * dx + srcMat.d * dy + srcMat.ty;
        N.raster->SetRasterMatrix(dstArt, &dstMat);

        /* 无损搬运专色填充/外观/透明蒙版/叠印/混合模式/不透明度 */
        N.art->TransferAttributes(srcArt, dstArt, kTransferStyle | kTransferOpacityMask);
        if (hasOverprint) N.raster->SetOverprint(dstArt, srcOverprint);
        if (N.blend) {
            N.blend->SetBlendingMode(dstArt, srcBlendMode);
            N.blend->SetOpacity(dstArt, srcOpacity);
        }
        N.art->SetArtBounds(dstArt);

        char nameBuf[64];
        snprintf(nameBuf, sizeof(nameBuf), "卡位_%02d", created + 1);
        UStr uName = {0};
        if (Utf8ToUStr(nameBuf, &uName)) {
            N.art->SetArtName(grp ? grp : dstArt, &uName);
            N.ustr->Destroy(&uName);
        }

        if (applyMask && grp) {
            AIArtHandle maskPath = NULL;
            if (N.art->NewArt(kPathArt, kPlaceInsideOnTop, grp, &maskPath) == 0 && maskPath) {
                AIPathSegment segs[4];
                double xs[4] = { rb.left, rb.right, rb.right, rb.left };
                double ys[4] = { rb.top,  rb.top,   rb.bottom, rb.bottom };
                for (int s = 0; s < 4; s++) {
                    segs[s].p.h = segs[s].in.h = segs[s].out.h = xs[s];
                    segs[s].p.v = segs[s].in.v = segs[s].out.v = ys[s];
                    segs[s].corner = 1;
                }
                N.path->SetPathSegmentCount(maskPath, 4);
                N.path->SetPathSegments(maskPath, 0, 4, segs);
                N.path->SetPathClosed(maskPath, 1);
                N.style->SetPathStyle(maskPath, &emptyStyle);
                /* AI SDK 要求: 必须先将组标记为剪切组, 再给顶层路径设置 kArtIsClipMask */
                N.group->SetGroupClipped(grp, 1);
                N.art->SetArtUserAttr(maskPath, kArtIsClipMask, kArtIsClipMask);
                N.art->SetArtBounds(maskPath);
                N.art->SetArtBounds(grp);
            }
        }
        created++;
    }

    if (hasCS) N.cs->DeleteColorSpace(&srcCS);
    free(rlist);

    if (hideSource && created > 0) {
        N.art->SetArtUserAttr(srcArt, kArtHidden, kArtHidden);
    }
    N.match->DeselectAll();
    N.doc->RedrawDocument();

    double sx = hypot(srcMat.a, srcMat.b);
    double dpi = sx > 1e-9 ? 72.0 / sx : 72.0;
    DWORD elapsed = GetTickCount() - t0;

    if (lastErr != 0 && created == 0) {
        SbAppendFmt(out, "{\"ok\":false,\"error\":\"原生裁切失败（错误码 0x%08X）。\"}", (unsigned)lastErr);
    } else {
        SbAppend(out, "{\"ok\":true,\"data\":{");
        SbAppendFmt(out, "\"count\":%d,\"skipped\":%d,\"width\":%d,\"height\":%d,\"dpi\":%.1f,\"applyMask\":%s,\"elapsedMs\":%lu,\"layer\":",
            created, skipped, srcW, srcH, dpi, applyMask ? "true" : "false", (unsigned long)elapsed);
        SbAppendJsonStr(out, layerTitle);
        SbAppend(out, ",\"spot\":");
        SbAppendJsonStr(out, spotName);
        SbAppend(out, ",\"colorSpace\":");
        SbAppendJsonStr(out, ColorSpaceLabel(srcRec.colorSpace, srcRec.bitsPerPixel));
        SbAppend(out, "}}");
    }

    ArtVecFree(&rasters);
    ArtVecFree(&rects);
}

/* ---------------- 命令 3 & 4: 专色百分比选区 ---------------- */

static int ExtractSpotFromColor(const AIColor *col, const char *whereLabel,
                                char *spotOut, int spotCap, double *pctOut, const char **whereOut)
{
    if (!col || col->kind != kCustomColor || !col->c.c.color) return 0;
    AICustomColor cc;
    memset(&cc, 0, sizeof(cc));
    if (N.cc->GetCustomColor(col->c.c.color, &cc) != 0) return 0;
    if (!(cc.flag & kCustomSpotColor) || (cc.flag & kCustomRegistrationColor)) return 0;
    UStr uname = {0};
    if (N.cc->GetCustomColorName(col->c.c.color, &uname) == 0) {
        UStrToUtf8(&uname, spotOut, spotCap);
        N.ustr->Destroy(&uname);
        if (spotOut[0]) {
            double pct = (1.0 - col->c.c.tint) * 100.0;
            if (pct < 0.0) pct = 0.0;
            if (pct > 100.0) pct = 100.0;
            *pctOut = pct;
            *whereOut = whereLabel;
            return 1;
        }
    }
    return 0;
}

static int ExtractSpotFromPathStyle(const AIPathStyle *st, const AIPathStyleMap *map,
                                    char *spotOut, int spotCap, double *pctOut, const char **whereOut)
{
    for (int pass = 0; pass < 2; pass++) {
        int active = (pass == 0) ? st->fillPaint : st->strokePaint;
        const AIColor *col = (pass == 0) ? &st->fill.color : &st->stroke.color;
        if (map) {
            int paintOk = (pass == 0) ? map->fillPaint : map->strokePaint;
            const AIColorMap *cmap = (pass == 0) ? &map->fill.color : &map->stroke.color;
            if (!paintOk || !active || !cmap->kind || col->kind != kCustomColor ||
                !cmap->c.c.color || !col->c.c.color || !cmap->c.c.tint) continue;
        } else {
            if (!active || col->kind != kCustomColor || !col->c.c.color) continue;
        }
        if (ExtractSpotFromColor(col, (pass == 0) ? "fill" : "stroke", spotOut, spotCap, pctOut, whereOut)) {
            return 1;
        }
    }
    return 0;
}

/* 遍历 AIArtStyle 外观面板中的全部填充与描边层(覆盖 ActiveStyle / Stack / Conduit Filter) */
static int ExtractSpotFromArtStyle(AIArtStyleHandle style,
                                   char *spotOut, int spotCap, double *pctOut, const char **whereOut)
{
    if (!style) return 0;
    if (N.styleParser && N.styleParser->NewParser && N.styleParser->ParseStyle &&
        N.styleParser->CountPaintFields && N.styleParser->GetNthPaintField &&
        N.styleParser->DisposeParser) {
        AIStyleParser parser = NULL;
        if (N.styleParser->NewParser(&parser) == 0 && parser) {
            int found = 0;
            if (N.styleParser->ParseStyle(parser, style) == 0 &&
                (!N.styleParser->IsStyleParseable || N.styleParser->IsStyleParseable(parser))) {
                int32_t cnt = N.styleParser->CountPaintFields(parser);
                for (int32_t i = 0; i < cnt && !found; i++) {
                    AIParserPaintField pf = NULL;
                    if (N.styleParser->GetNthPaintField(parser, i, &pf) != 0 || !pf) continue;
                    AIArtStylePaintDataBuf pd;
                    memset(&pd, 0, sizeof(pd));
                    if (N.styleParser->IsFill && N.styleParser->GetFill && N.styleParser->IsFill(pf)) {
                        AIFillStyle fs;
                        memset(&fs, 0, sizeof(fs));
                        if (N.styleParser->GetFill(pf, &fs, &pd) == 0) {
                            found = ExtractSpotFromColor(&fs.color, "fill", spotOut, spotCap, pctOut, whereOut);
                        }
                    } else if (N.styleParser->IsStroke && N.styleParser->GetStroke && N.styleParser->IsStroke(pf)) {
                        AIStrokeStyle ss;
                        memset(&ss, 0, sizeof(ss));
                        if (N.styleParser->GetStroke(pf, &ss, &pd) == 0) {
                            found = ExtractSpotFromColor(&ss.color, "stroke", spotOut, spotCap, pctOut, whereOut);
                        }
                    }
                }
            }
            N.styleParser->DisposeParser(parser);
            if (found) return 1;
        }
    }
    if (N.artStyle && N.artStyle->GetPaintAttributes) {
        AIPathStyle st;
        AIArtStylePaintDataBuf pd;
        memset(&st, 0, sizeof(st));
        memset(&pd, 0, sizeof(pd));
        if (N.artStyle->GetPaintAttributes(style, &st, &pd) == 0) {
            if (ExtractSpotFromPathStyle(&st, NULL, spotOut, spotCap, pctOut, whereOut)) return 1;
        }
    }
    return 0;
}

typedef struct {
    char       *spotOut;
    int         spotCap;
    double     *pctOut;
    const char **whereOut;
    const char *label;
    int         found;
} SpotInspectCtx;

static void SpotInspectCallback(AIColor *color, void *userData, AIErr *result, AIBoolean *altered)
{
    (void)result;
    if (altered) *altered = 0;
    SpotInspectCtx *ctx = (SpotInspectCtx *)userData;
    if (!ctx || ctx->found) return;
    if (ExtractSpotFromColor(color, ctx->label, ctx->spotOut, ctx->spotCap, ctx->pctOut, ctx->whereOut)) {
        ctx->found = 1;
    }
}

static int ExtractArtSpotSample(AIArtHandle art, char *spotOut, int spotCap, double *pctOut, const char **whereOut)
{
    short type = 0;
    if (N.art->GetArtType(art, &type) != 0) return 0;

    /* 优先检查对象自身的外观样式(如带专色外观填充的编组) */
    if (N.artStyle && N.artStyle->GetArtStyle) {
        AIArtStyleHandle ownStyle = NULL;
        if (N.artStyle->GetArtStyle(art, &ownStyle) == 0 && ownStyle) {
            if (ExtractSpotFromArtStyle(ownStyle, spotOut, spotCap, pctOut, whereOut)) return 1;
        }
    }

    if (type == kGroupArt || type == kCompoundPathArt) {
        AIArtHandle ch = NULL;
        if (N.art->GetArtFirstChild(art, &ch) == 0) {
            while (ch) {
                if (ExtractArtSpotSample(ch, spotOut, spotCap, pctOut, whereOut)) return 1;
                AIArtHandle nx = NULL;
                if (N.art->GetArtSibling(ch, &nx) != 0) break;
                ch = nx;
            }
        }
        /* 兜底: 编组/复合路径外观中的渐变或效果专色 */
        if (N.style && N.style->AdjustObjectAIColors) {
            SpotInspectCtx ic = { spotOut, spotCap, pctOut, whereOut, "fill", 0 };
            N.style->AdjustObjectAIColors(art, SpotInspectCallback, &ic,
                kVisitColorsReadOnly | kVisitColorsSolidOnly | kVisitColorsFillsOnly, NULL);
            if (ic.found) return 1;
            ic.label = "stroke";
            N.style->AdjustObjectAIColors(art, SpotInspectCallback, &ic,
                kVisitColorsReadOnly | kVisitColorsSolidOnly | kVisitColorsStrokesOnly, NULL);
            if (ic.found) return 1;
        }
        return 0;
    }
    if (type == kPathArt) {
        AIBoolean isGuide = 0;
        N.path->GetPathGuide(art, &isGuide);
        if (isGuide) return 0;
    }

    AIPathStyle st;
    AIBoolean hasAdv = 0;
    memset(&st, 0, sizeof(st));
    if (N.style->GetPathStyle(art, &st, &hasAdv) == 0) {
        if (ExtractSpotFromPathStyle(&st, NULL, spotOut, spotCap, pctOut, whereOut)) return 1;
    }

    /* 覆盖可编辑文字、外观多填充/多描边、渐变、网格、混合/封套与符号 */
    if (N.style && N.style->AdjustObjectAIColors) {
        SpotInspectCtx ic = { spotOut, spotCap, pctOut, whereOut, "fill", 0 };
        N.style->AdjustObjectAIColors(art, SpotInspectCallback, &ic,
            kVisitColorsReadOnly | kVisitColorsSolidOnly | kVisitColorsInResultArt | kVisitColorsFillsOnly, NULL);
        if (ic.found) return 1;
        ic.label = "stroke";
        N.style->AdjustObjectAIColors(art, SpotInspectCallback, &ic,
            kVisitColorsReadOnly | kVisitColorsSolidOnly | kVisitColorsInResultArt | kVisitColorsStrokesOnly, NULL);
        if (ic.found) return 1;
    }

    if (type == kRasterArt) {
        double rTint = 100.0;
        GetRasterSpotInfo(art, spotOut, spotCap, &rTint);
        if (spotOut[0]) {
            *pctOut = rTint;
            *whereOut = "fill";
            return 1;
        }
    }
    return 0;
}

static void HandleSpotSelectInspect(StrBuf *out)
{
    AIDocumentHandle docH = NULL;
    if (N.doc->GetDocument(&docH) != 0 || !docH) {
        SbAppend(out, "{\"ok\":false,\"error\":\"请先打开文档。\"}");
        return;
    }

    SbAppend(out, "{\"ok\":true,\"data\":{\"spots\":[");
    int32_t ccCount = 0;
    int emitted = 0;
    if (N.cc->CountCustomColors(&ccCount) == 0) {
        for (int32_t i = 0; i < ccCount; i++) {
            AICustomColorHandle h = NULL;
            if (N.cc->GetNthCustomColor(i, &h) != 0 || !h) continue;
            AICustomColor cc;
            memset(&cc, 0, sizeof(cc));
            if (N.cc->GetCustomColor(h, &cc) != 0) continue;
            if (!(cc.flag & kCustomSpotColor) || (cc.flag & kCustomRegistrationColor)) continue;
            UStr uname = {0};
            if (N.cc->GetCustomColorName(h, &uname) == 0) {
                char buf[256];
                UStrToUtf8(&uname, buf, sizeof(buf));
                N.ustr->Destroy(&uname);
                if (buf[0]) {
                    if (emitted++) SbAppendN(out, ",", 1);
                    SbAppendJsonStr(out, buf);
                }
            }
        }
    }
    SbAppend(out, "]");

    /* 读取当前选区专色样本: 优先 GetCurrentPathStyle(与颜色面板一致,覆盖文字/外观/组合), 再递归兜底 */
    AIArtHandle **sel = NULL;
    int32_t selCount = 0;
    char sampleSpot[256] = {0};
    double samplePct = 100.0;
    const char *sampleWhere = "";
    int hasSample = 0;
    if (N.match->GetSelectedArt(&sel, &selCount) == 0 && sel) {
        if (selCount > 0 && N.style && N.style->GetCurrentPathStyle) {
            union { AIPathStyle s; unsigned char pad[1024]; } curSt;
            union { AIPathStyleMap m; unsigned char pad[512]; } curMap;
            AIBoolean hasAdv = 0;
            memset(&curSt, 0, sizeof(curSt));
            memset(&curMap, 0, sizeof(curMap));
            if (N.style->GetCurrentPathStyle(&curSt.s, &curMap.m, NULL, &hasAdv) == 0) {
                hasSample = ExtractSpotFromPathStyle(&curSt.s, &curMap.m, sampleSpot, sizeof(sampleSpot), &samplePct, &sampleWhere);
            }
        }
        for (int32_t i = 0; i < selCount && !hasSample; i++) {
            hasSample = ExtractArtSpotSample((*sel)[i], sampleSpot, sizeof(sampleSpot), &samplePct, &sampleWhere);
        }
        N.mem->MdMemoryDisposeHandle((AIMdMemoryHandle)sel);
    }
    SbAppendFmt(out, ",\"selection\":%d", (int)selCount);
    if (hasSample) {
        SbAppend(out, ",\"sample\":{\"spot\":");
        SbAppendJsonStr(out, sampleSpot);
        SbAppendFmt(out, ",\"percent\":%.2f,\"where\":", samplePct);
        SbAppendJsonStr(out, sampleWhere);
        SbAppend(out, "}");
    } else {
        SbAppend(out, ",\"sample\":null");
    }
    SbAppend(out, "}}");
}

static int MatchPercent(double actual, double target, const char *mode, double tol)
{
    const double eps = 0.05;
    if (strcmp(mode, "gt") == 0)  return actual > target + eps;
    if (strcmp(mode, "gte") == 0) return actual >= target - eps;
    if (strcmp(mode, "lt") == 0)  return actual < target - eps;
    if (strcmp(mode, "lte") == 0) return actual <= target + eps;
    return fabs(actual - target) <= (tol > eps ? tol : eps);
}

typedef struct {
    AICustomColorHandle targetCC;
    const char         *spotName;
    double              targetPct;
    const char         *mode;
    double              tol;
    int                 matched;
} SpotMatchCtx;

static int IsTargetCustomColor(AICustomColorHandle cc, AICustomColorHandle targetCC, const char *spotName)
{
    if (!cc) return 0;
    if (cc == targetCC) return 1;
    UStr uname = {0};
    if (N.cc->GetCustomColorName(cc, &uname) == 0) {
        char buf[256];
        UStrToUtf8(&uname, buf, sizeof(buf));
        N.ustr->Destroy(&uname);
        if (buf[0] && strcmp(buf, spotName) == 0) return 1;
    }
    return 0;
}

static int MatchColorSpot(const AIColor *color, const SpotMatchCtx *ctx)
{
    if (!color || color->kind != kCustomColor || !color->c.c.color) return 0;
    if (!IsTargetCustomColor(color->c.c.color, ctx->targetCC, ctx->spotName)) return 0;
    double pct = (1.0 - color->c.c.tint) * 100.0;
    if (pct < 0.0) pct = 0.0;
    if (pct > 100.0) pct = 100.0;
    return MatchPercent(pct, ctx->targetPct, ctx->mode, ctx->tol);
}

static void SpotMatchCallback(AIColor *color, void *userData, AIErr *result, AIBoolean *altered)
{
    (void)result;
    if (altered) *altered = 0;
    SpotMatchCtx *ctx = (SpotMatchCtx *)userData;
    if (!ctx || ctx->matched) return;
    if (MatchColorSpot(color, ctx)) {
        ctx->matched = 1;
    }
}

static int MatchArtByColors(AIArtHandle art, const SpotMatchCtx *baseCtx, int matchFill, int matchStroke)
{
    if (!N.style || !N.style->AdjustObjectAIColors) return 0;
    SpotMatchCtx ctx = *baseCtx;
    ctx.matched = 0;
    uint16_t flags = (uint16_t)(kVisitColorsReadOnly | kVisitColorsSolidOnly | kVisitColorsInResultArt);
    if (matchFill && !matchStroke) flags |= kVisitColorsFillsOnly;
    else if (!matchFill && matchStroke) flags |= kVisitColorsStrokesOnly;
    N.style->AdjustObjectAIColors(art, SpotMatchCallback, &ctx, flags, NULL);
    return ctx.matched;
}

static int MatchPathStyleDirect(AIArtHandle art, const SpotMatchCtx *ctx, int matchFill, int matchStroke)
{
    if (!N.style || !N.style->GetPathStyle) return 0;
    AIPathStyle st;
    AIBoolean hasAdv = 0;
    memset(&st, 0, sizeof(st));
    if (N.style->GetPathStyle(art, &st, &hasAdv) != 0) return 0;
    if (matchFill && st.fillPaint && MatchColorSpot(&st.fill.color, ctx)) return 1;
    if (matchStroke && st.strokePaint && MatchColorSpot(&st.stroke.color, ctx)) return 1;
    return 0;
}

/* 遍历对象自身 AIArtStyle 的全部外观填充/描边层(支持 ActiveStyle / 多填多描 / Conduit Filter 编组) */
static int MatchArtStylePaintFields(AIArtStyleHandle style, const SpotMatchCtx *ctx, int matchFill, int matchStroke)
{
    if (!style) return 0;
    if (N.styleParser && N.styleParser->NewParser && N.styleParser->ParseStyle &&
        N.styleParser->CountPaintFields && N.styleParser->GetNthPaintField &&
        N.styleParser->DisposeParser) {
        AIStyleParser parser = NULL;
        if (N.styleParser->NewParser(&parser) == 0 && parser) {
            int hit = 0;
            if (N.styleParser->ParseStyle(parser, style) == 0 &&
                (!N.styleParser->IsStyleParseable || N.styleParser->IsStyleParseable(parser))) {
                int32_t cnt = N.styleParser->CountPaintFields(parser);
                for (int32_t i = 0; i < cnt && !hit; i++) {
                    AIParserPaintField pf = NULL;
                    if (N.styleParser->GetNthPaintField(parser, i, &pf) != 0 || !pf) continue;
                    AIArtStylePaintDataBuf pd;
                    memset(&pd, 0, sizeof(pd));
                    if (matchFill && N.styleParser->IsFill && N.styleParser->GetFill && N.styleParser->IsFill(pf)) {
                        AIFillStyle fs;
                        memset(&fs, 0, sizeof(fs));
                        if (N.styleParser->GetFill(pf, &fs, &pd) == 0 && MatchColorSpot(&fs.color, ctx)) {
                            hit = 1;
                        }
                    } else if (matchStroke && N.styleParser->IsStroke && N.styleParser->GetStroke && N.styleParser->IsStroke(pf)) {
                        AIStrokeStyle ss;
                        memset(&ss, 0, sizeof(ss));
                        if (N.styleParser->GetStroke(pf, &ss, &pd) == 0 && MatchColorSpot(&ss.color, ctx)) {
                            hit = 1;
                        }
                    }
                }
            }
            N.styleParser->DisposeParser(parser);
            if (hit) return 1;
        }
    }
    if (N.artStyle && N.artStyle->GetPaintAttributes) {
        AIPathStyle st;
        AIArtStylePaintDataBuf pd;
        memset(&st, 0, sizeof(st));
        memset(&pd, 0, sizeof(pd));
        if (N.artStyle->GetPaintAttributes(style, &st, &pd) == 0) {
            if (matchFill && st.fillPaint && MatchColorSpot(&st.fill.color, ctx)) return 1;
            if (matchStroke && st.strokePaint && MatchColorSpot(&st.stroke.color, ctx)) return 1;
        }
    }
    return 0;
}

static int MatchArtOwnStyle(AIArtHandle art, const SpotMatchCtx *ctx, int matchFill, int matchStroke)
{
    if (!N.artStyle || !N.artStyle->GetArtStyle) return 0;
    AIArtStyleHandle style = NULL;
    if (N.artStyle->GetArtStyle(art, &style) != 0 || !style) return 0;
    return MatchArtStylePaintFields(style, ctx, matchFill, matchStroke);
}

static AIArtHandle GetTopmostCompoundAncestor(AIArtHandle art)
{
    AIArtHandle topCompound = NULL;
    AIArtHandle cur = art;
    while (cur) {
        short t = 0;
        if (N.art->GetArtType(cur, &t) == 0 && t == kCompoundPathArt) {
            topCompound = cur;
        }
        AIArtHandle par = NULL;
        if (N.art->GetArtParent(cur, &par) != 0 || !par || par == cur) break;
        cur = par;
    }
    return topCompound ? topCompound : art;
}

/* 递归选中对象及其子路径: Illustrator 中复合路径/编组需将内部子路径一并标为 kArtSelected 才能在画布和选区中完整生效 */
static void SelectArtRecursive(AIArtHandle art)
{
    if (!art) return;
    int32_t attr = 0;
    if (N.art->GetArtUserAttr(art, kArtHidden | kArtLocked, &attr) == 0 && (attr & (kArtHidden | kArtLocked))) {
        return;
    }
    short type = 0;
    if (N.art->GetArtType(art, &type) != 0) return;
    if (type == kCompoundPathArt || type == kGroupArt) {
        AIArtHandle ch = NULL;
        if (N.art->GetArtFirstChild(art, &ch) == 0) {
            while (ch) {
                SelectArtRecursive(ch);
                AIArtHandle nx = NULL;
                if (N.art->GetArtSibling(ch, &nx) != 0) break;
                ch = nx;
            }
        }
    }
    N.art->SetArtUserAttr(art, kArtSelected, kArtSelected);
}

/* 递归检查复合路径下所有子路径(兼容复合路径内嵌套编组的结构) */
static int MatchCompoundChildren(AIArtHandle container, const SpotMatchCtx *ctx, int matchFill, int matchStroke)
{
    AIArtHandle ch = NULL;
    if (N.art->GetArtFirstChild(container, &ch) != 0) return 0;
    while (ch) {
        short t = 0;
        if (N.art->GetArtType(ch, &t) == 0) {
            if (t == kPathArt) {
                if (MatchPathStyleDirect(ch, ctx, matchFill, matchStroke)) return 1;
                if (MatchArtOwnStyle(ch, ctx, matchFill, matchStroke)) return 1;
                if (MatchArtByColors(ch, ctx, matchFill, matchStroke)) return 1;
            } else if (t == kGroupArt || t == kCompoundPathArt) {
                if (MatchArtOwnStyle(ch, ctx, matchFill, matchStroke)) return 1;
                if (MatchCompoundChildren(ch, ctx, matchFill, matchStroke)) return 1;
            }
        }
        AIArtHandle nx = NULL;
        if (N.art->GetArtSibling(ch, &nx) != 0) break;
        ch = nx;
    }
    return 0;
}

static void HandleSpotSelectRun(const char *reqJson, StrBuf *out)
{
    AIDocumentHandle docH = NULL;
    if (N.doc->GetDocument(&docH) != 0 || !docH) {
        SbAppend(out, "{\"ok\":false,\"error\":\"请先打开文档。\"}");
        return;
    }

    char spotName[256] = {0};
    char mode[16]      = "eq";
    JsonGetStr(reqJson, "spot", spotName, sizeof(spotName));
    JsonGetStr(reqJson, "mode", mode, sizeof(mode));
    double targetPct   = JsonGetNum(reqJson, "percent", 100.0);
    double tol         = JsonGetNum(reqJson, "tolerance", 0.5);
    int matchFill      = JsonGetBool(reqJson, "matchFill", 1);
    int matchStroke    = JsonGetBool(reqJson, "matchStroke", 1);

    if (!spotName[0]) {
        SbAppend(out, "{\"ok\":false,\"error\":\"请选择目标专色。\"}");
        return;
    }
    if (!matchFill && !matchStroke) {
        SbAppend(out, "{\"ok\":false,\"error\":\"请至少勾选「填充」或「描边」。\"}");
        return;
    }
    if (targetPct < 0.0 || targetPct > 100.0) {
        SbAppend(out, "{\"ok\":false,\"error\":\"专色百分比必须在 0 到 100 之间。\"}");
        return;
    }
    if (tol < 0.0) tol = 0.0;

    UStr uSpot = {0};
    AICustomColorHandle targetCC = NULL;
    if (!Utf8ToUStr(spotName, &uSpot) || N.cc->GetCustomColorByName(&uSpot, &targetCC) != 0 || !targetCC) {
        if (uSpot.fImpl) N.ustr->Destroy(&uSpot);
        SbAppend(out, "{\"ok\":false,\"error\":\"当前文档中找不到该专色，请刷新专色列表。\"}");
        return;
    }
    N.ustr->Destroy(&uSpot);

    AIMatchingArtSpec spec;
    spec.type = kAnyArt;
    spec.whichAttr = 0;
    spec.attr = 0;

    AIArtHandle **all = NULL;
    int32_t allCount = 0;
    if (N.match->GetMatchingArt(&spec, 1, &all, &allCount) != 0) {
        SbAppend(out, "{\"ok\":false,\"error\":\"无法遍历文档对象。\"}");
        return;
    }

    SpotMatchCtx baseCtx;
    baseCtx.targetCC  = targetCC;
    baseCtx.spotName  = spotName;
    baseCtx.targetPct = targetPct;
    baseCtx.mode      = mode;
    baseCtx.tol       = tol;
    baseCtx.matched   = 0;

    ArtVec picked = {0};
    if (all && allCount > 0) {
        for (int32_t i = 0; i < allCount; i++) {
            AIArtHandle art = (*all)[i];
            if (!art || !IsArtVisibleAndUnlocked(art)) continue;

            short type = 0;
            if (N.art->GetArtType(art, &type) != 0) continue;

            AIArtHandle topTarget = GetTopmostCompoundAncestor(art);
            if (ArtVecContains(&picked, topTarget)) continue;

            if (type == kPathArt) {
                AIBoolean isGuide = 0;
                N.path->GetPathGuide(art, &isGuide);
                if (isGuide) continue;
            }

            /* 编组仅在自身外观面板(含多填充/多描边/ActiveStyle)命中目标专色时才选中, 绝不因普通子对象误选整组 */
            if (type == kGroupArt) {
                if (topTarget != art) {
                    /* 复合路径内嵌套编组: 若自身外观命中则选中外层复合路径 */
                    if (MatchArtOwnStyle(art, &baseCtx, matchFill, matchStroke)) {
                        ArtVecPushUnique(&picked, topTarget);
                    }
                    continue;
                }
                AIArtHandle par = NULL;
                if (N.art->GetArtParent(art, &par) != 0 || !par || par == art) continue; /* 跳过图层根组 */
                if (MatchArtOwnStyle(art, &baseCtx, matchFill, matchStroke)) {
                    ArtVecPushUnique(&picked, art);
                }
                continue;
            }

            int hit = 0;
            if (type == kPathArt) {
                /* 同时覆盖独立路径与复合路径子路径(若为复合路径子路径, 命中后统一收敛到最外层复合路径并去重) */
                hit = MatchPathStyleDirect(art, &baseCtx, matchFill, matchStroke);
                if (!hit) hit = MatchArtOwnStyle(art, &baseCtx, matchFill, matchStroke);
                if (!hit) hit = MatchArtByColors(art, &baseCtx, matchFill, matchStroke);
            } else if (type == kCompoundPathArt) {
                hit = MatchArtOwnStyle(art, &baseCtx, matchFill, matchStroke);
                if (!hit) hit = MatchPathStyleDirect(art, &baseCtx, matchFill, matchStroke);
                if (!hit) hit = MatchCompoundChildren(art, &baseCtx, matchFill, matchStroke);
                if (!hit) hit = MatchArtByColors(art, &baseCtx, matchFill, matchStroke);
            } else if (type == kRasterArt) {
                hit = MatchPathStyleDirect(art, &baseCtx, matchFill, matchStroke);
                if (!hit) hit = MatchArtOwnStyle(art, &baseCtx, matchFill, matchStroke);
                if (!hit) hit = MatchArtByColors(art, &baseCtx, matchFill, matchStroke);
                if (!hit && matchFill) {
                    char rSpot[256];
                    double rTint = 100.0;
                    GetRasterSpotInfo(art, rSpot, sizeof(rSpot), &rTint);
                    if (rSpot[0] && strcmp(rSpot, spotName) == 0 && MatchPercent(rTint, targetPct, mode, tol)) {
                        hit = 1;
                    }
                }
            } else if (type == kTextFrameArt || type == kMeshArt || type == kPluginArt ||
                       type == kSymbolArt || type == kPlacedArt || type >= 14) {
                hit = MatchArtOwnStyle(art, &baseCtx, matchFill, matchStroke);
                if (!hit) hit = MatchArtByColors(art, &baseCtx, matchFill, matchStroke);
            }

            if (hit) {
                ArtVecPushUnique(&picked, topTarget);
            }
        }
    }
    if (all) N.mem->MdMemoryDisposeHandle((AIMdMemoryHandle)all);

    N.match->DeselectAll();
    for (int i = 0; i < picked.count; i++) {
        SelectArtRecursive(picked.items[i]);
    }
    N.doc->RedrawDocument();

    SbAppend(out, "{\"ok\":true,\"data\":{");
    SbAppendFmt(out, "\"matched\":%d,\"percent\":%.2f,\"mode\":", picked.count, targetPct);
    SbAppendJsonStr(out, mode);
    SbAppend(out, ",\"spot\":");
    SbAppendJsonStr(out, spotName);
    SbAppend(out, "}}");

    ArtVecFree(&picked);
}

/* ---------------- 命令 5 & 6: 批量蒙版 (按刀线覆盖范围原位建立剪切蒙版) ---------------- */

static int ArtStyleHasVisibleFill(AIArtStyleHandle style)
{
    if (!style) return 0;
    if (N.styleParser && N.styleParser->NewParser && N.styleParser->ParseStyle &&
        N.styleParser->CountPaintFields && N.styleParser->GetNthPaintField &&
        N.styleParser->DisposeParser) {
        AIStyleParser parser = NULL;
        if (N.styleParser->NewParser(&parser) == 0 && parser) {
            int hasFill = 0;
            if (N.styleParser->ParseStyle(parser, style) == 0 &&
                (!N.styleParser->IsStyleParseable || N.styleParser->IsStyleParseable(parser))) {
                int32_t cnt = N.styleParser->CountPaintFields(parser);
                for (int32_t i = 0; i < cnt && !hasFill; i++) {
                    AIParserPaintField pf = NULL;
                    if (N.styleParser->GetNthPaintField(parser, i, &pf) != 0 || !pf) continue;
                    if (N.styleParser->IsFill && N.styleParser->GetFill && N.styleParser->IsFill(pf)) {
                        AIFillStyle fs;
                        AIArtStylePaintDataBuf pd;
                        memset(&fs, 0, sizeof(fs));
                        memset(&pd, 0, sizeof(pd));
                        if (N.styleParser->GetFill(pf, &fs, &pd) == 0 && fs.color.kind != kNoneColor) {
                            hasFill = 1;
                        }
                    }
                }
            }
            N.styleParser->DisposeParser(parser);
            return hasFill;
        }
    }
    if (N.artStyle && N.artStyle->GetPaintAttributes) {
        AIPathStyle st;
        AIArtStylePaintDataBuf pd;
        memset(&st, 0, sizeof(st));
        memset(&pd, 0, sizeof(pd));
        if (N.artStyle->GetPaintAttributes(style, &st, &pd) == 0) {
            if (st.fillPaint && st.fill.color.kind != kNoneColor) return 1;
        }
    }
    return 0;
}

static int PathOrCompoundHasFill(AIArtHandle art)
{
    if (!art) return 0;
    if (N.artStyle && N.artStyle->GetArtStyle) {
        AIArtStyleHandle own = NULL;
        if (N.artStyle->GetArtStyle(art, &own) == 0 && own && ArtStyleHasVisibleFill(own)) return 1;
    }
    short type = 0;
    if (N.art->GetArtType(art, &type) != 0) return 0;
    if (type == kPathArt) {
        AIPathStyle st;
        AIBoolean hasAdv = 0;
        memset(&st, 0, sizeof(st));
        if (N.style->GetPathStyle(art, &st, &hasAdv) == 0 && st.fillPaint && st.fill.color.kind != kNoneColor) {
            return 1;
        }
        return 0;
    }
    if (type == kCompoundPathArt || type == kGroupArt) {
        AIArtHandle ch = NULL;
        if (N.art->GetArtFirstChild(art, &ch) == 0) {
            while (ch) {
                if (PathOrCompoundHasFill(ch)) return 1;
                AIArtHandle nx = NULL;
                if (N.art->GetArtSibling(ch, &nx) != 0) break;
                ch = nx;
            }
        }
    }
    return 0;
}

static int CompoundHasClosedPath(AIArtHandle art)
{
    AIArtHandle ch = NULL;
    if (N.art->GetArtFirstChild(art, &ch) != 0) return 0;
    while (ch) {
        short t = 0;
        if (N.art->GetArtType(ch, &t) == 0) {
            if (t == kPathArt) {
                AIBoolean closed = 0, isGuide = 0;
                N.path->GetPathGuide(ch, &isGuide);
                N.path->GetPathClosed(ch, &closed);
                if (!isGuide && closed) return 1;
            } else if (t == kGroupArt || t == kCompoundPathArt) {
                if (CompoundHasClosedPath(ch)) return 1;
            }
        }
        AIArtHandle nx = NULL;
        if (N.art->GetArtSibling(ch, &nx) != 0) break;
        ch = nx;
    }
    return 0;
}

static int GetArtVisualBounds(AIArtHandle art, AIRealRect *out)
{
    memset(out, 0, sizeof(*out));
    if (!art) return 0;
    if (N.art->GetArtTransformBounds(art, NULL, kVisibleBounds | kNoStrokeBounds, out) == 0) {
        return 1;
    }
    return (N.art->GetArtBounds(art, out) == 0);
}

static int IsClosedDieCutShape(AIArtHandle art, int requireNoFill)
{
    if (!art || !IsArtVisibleAndUnlocked(art)) return 0;
    int32_t attr = 0;
    if (N.art->GetArtUserAttr(art, kArtIsClipMask, &attr) == 0 && (attr & kArtIsClipMask)) return 0;

    short type = 0;
    if (N.art->GetArtType(art, &type) != 0) return 0;
    if (type == kPathArt) {
        AIBoolean isGuide = 0, closed = 0;
        N.path->GetPathGuide(art, &isGuide);
        N.path->GetPathClosed(art, &closed);
        if (isGuide || !closed) return 0;
    } else if (type == kCompoundPathArt) {
        if (!CompoundHasClosedPath(art)) return 0;
    } else {
        return 0;
    }

    AIRealRect rb;
    if (!GetArtVisualBounds(art, &rb)) return 0;
    if ((rb.right - rb.left) <= 0.5 || (rb.top - rb.bottom) <= 0.5) return 0;

    if (requireNoFill && PathOrCompoundHasFill(art)) return 0;
    return 1;
}

/* 判断编组是否为纯刀线编组(非剪切组, 至少含 1 条刀线且所有非参考线叶子均为闭合刀线) */
static int IsPureDieCutGroupRec(AIArtHandle grp, int requireNoFill, int *foundCount)
{
    if (!grp || !IsArtVisibleAndUnlocked(grp)) return 0;
    short type = 0;
    if (N.art->GetArtType(grp, &type) != 0 || type != kGroupArt) return 0;
    AIBoolean clipped = 0;
    if (N.group->GetGroupClipped(grp, &clipped) == 0 && clipped) return 0;
    if (requireNoFill && N.artStyle && N.artStyle->GetArtStyle) {
        AIArtStyleHandle own = NULL;
        if (N.artStyle->GetArtStyle(grp, &own) == 0 && own && ArtStyleHasVisibleFill(own)) return 0;
    }
    AIArtHandle ch = NULL;
    if (N.art->GetArtFirstChild(grp, &ch) != 0 || !ch) return 0;
    while (ch) {
        short ct = 0;
        if (N.art->GetArtType(ch, &ct) == 0) {
            if (ct == kPathArt) {
                AIBoolean isGuide = 0;
                N.path->GetPathGuide(ch, &isGuide);
                if (!isGuide) {
                    if (!IsClosedDieCutShape(ch, requireNoFill)) return 0;
                    (*foundCount)++;
                }
            } else if (ct == kCompoundPathArt) {
                if (!IsClosedDieCutShape(ch, requireNoFill)) return 0;
                (*foundCount)++;
            } else if (ct == kGroupArt) {
                if (!IsPureDieCutGroupRec(ch, requireNoFill, foundCount)) return 0;
            } else {
                return 0;
            }
        }
        AIArtHandle nx = NULL;
        if (N.art->GetArtSibling(ch, &nx) != 0) break;
        ch = nx;
    }
    return (*foundCount) > 0;
}

static int IsPureDieCutGroup(AIArtHandle grp, int requireNoFill)
{
    int found = 0;
    return IsPureDieCutGroupRec(grp, requireNoFill, &found);
}

static void ExtractDieCutsFromContainer(AIArtHandle art, int requireNoFill, ArtVec *dieCuts)
{
    if (!art) return;
    short type = 0;
    if (N.art->GetArtType(art, &type) != 0) return;
    if (type == kPathArt || type == kCompoundPathArt) {
        if (IsClosedDieCutShape(art, requireNoFill)) {
            ArtVecPushUnique(dieCuts, art);
        }
        return;
    }
    if (type == kGroupArt) {
        AIArtHandle ch = NULL;
        if (N.art->GetArtFirstChild(art, &ch) == 0) {
            while (ch) {
                ExtractDieCutsFromContainer(ch, requireNoFill, dieCuts);
                AIArtHandle nx = NULL;
                if (N.art->GetArtSibling(ch, &nx) != 0) break;
                ch = nx;
            }
        }
    }
}

/* 按文档真实渲染堆叠顺序排序(从最顶层到最底层), 严格保持遮挡层级 */
static void SortArtsByPaintOrder(ArtVec *vec)
{
    if (!vec || vec->count <= 1 || !N.art->GetArtOrder) return;
    for (int i = 1; i < vec->count; i++) {
        AIArtHandle key = vec->items[i];
        int j = i - 1;
        while (j >= 0) {
            short ord = 0;
            if (N.art->GetArtOrder(key, vec->items[j], &ord) == 0 && ord == kFirstBeforeSecond) {
                vec->items[j + 1] = vec->items[j];
                j--;
            } else {
                break;
            }
        }
        vec->items[j + 1] = key;
    }
}

static int HasAncestorInVec(AIArtHandle art, const ArtVec *set)
{
    AIArtHandle cur = art;
    while (cur) {
        AIArtHandle par = NULL;
        if (N.art->GetArtParent(cur, &par) != 0 || !par || par == cur) break;
        if (ArtVecContains(set, par)) return 1;
        cur = par;
    }
    return 0;
}

static void CollectTopSelectedArts(ArtVec *out)
{
    AIArtHandle **matches = NULL;
    int32_t num = 0;

    AIMatchingArtSpec spec;
    spec.type = kAnyArt;
    spec.whichAttr = kArtSelectedTopLevelGroups;
    spec.attr = kArtSelectedTopLevelGroups;
    if (N.match->GetMatchingArt(&spec, 1, &matches, &num) == 0 && matches && num > 0) {
        for (int32_t i = 0; i < num; i++) {
            AIArtHandle h = (*matches)[i];
            if (!h || !IsArtVisibleAndUnlocked(h)) continue;
            AIArtHandle par = NULL;
            if (N.art->GetArtParent(h, &par) != 0 || !par || par == h) continue; /* 跳过图层根组 */
            short t = 0;
            if (N.art->GetArtType(h, &t) == 0 && t == kPathArt) {
                AIBoolean isGuide = 0;
                N.path->GetPathGuide(h, &isGuide);
                if (isGuide) continue;
            }
            ArtVecPushUnique(out, h);
        }
        N.mem->MdMemoryDisposeHandle((AIMdMemoryHandle)matches);
    } else {
        if (matches) N.mem->MdMemoryDisposeHandle((AIMdMemoryHandle)matches);
        matches = NULL;
        num = 0;
        if (N.match->GetSelectedArt(&matches, &num) == 0 && matches && num > 0) {
            ArtVec raw = {0};
            for (int32_t i = 0; i < num; i++) {
                AIArtHandle h = (*matches)[i];
                if (!h || !IsArtVisibleAndUnlocked(h)) continue;
                AIArtHandle par = NULL;
                if (N.art->GetArtParent(h, &par) != 0 || !par || par == h) continue;
                ArtVecPushUnique(&raw, h);
            }
            for (int i = 0; i < raw.count; i++) {
                AIArtHandle h = raw.items[i];
                if (HasAncestorInVec(h, &raw)) continue;
                short t = 0;
                if (N.art->GetArtType(h, &t) == 0 && t == kPathArt) {
                    AIBoolean isGuide = 0;
                    N.path->GetPathGuide(h, &isGuide);
                    if (isGuide) continue;
                }
                ArtVecPushUnique(out, h);
            }
            ArtVecFree(&raw);
        }
        if (matches) N.mem->MdMemoryDisposeHandle((AIMdMemoryHandle)matches);
    }

    SortArtsByPaintOrder(out);
}

static void PartitionDieCutsAndContents(const ArtVec *topSel, const char *detectMode,
                                        ArtVec *dieCuts, ArtVec *dieCutGroups, ArtVec *contents,
                                        const char **usedModeOut)
{
    int forceTop = (detectMode && strcmp(detectMode, "top") == 0);
    *usedModeOut = forceTop ? "top" : "nofill";

    if (!forceTop) {
        for (int i = 0; i < topSel->count; i++) {
            AIArtHandle h = topSel->items[i];
            if (IsClosedDieCutShape(h, 1)) {
                ArtVecPushUnique(dieCuts, h);
            } else if (IsPureDieCutGroup(h, 1)) {
                ArtVecPushUnique(dieCutGroups, h);
                ExtractDieCutsFromContainer(h, 1, dieCuts);
            } else {
                ArtVecPushUnique(contents, h);
            }
        }
        if (dieCuts->count > 0) return;
        /* 若未找到无填充刀线且至少选中 2 个对象, 自动兜底将最顶层闭合对象或刀线组识别为刀线 */
        ArtVecFree(dieCuts);
        ArtVecFree(dieCutGroups);
        ArtVecFree(contents);
    }

    if (topSel->count >= 2) {
        AIArtHandle top = topSel->items[0];
        if (IsClosedDieCutShape(top, 0)) {
            *usedModeOut = "top";
            ArtVecPushUnique(dieCuts, top);
            for (int i = 1; i < topSel->count; i++) ArtVecPushUnique(contents, topSel->items[i]);
            return;
        }
        if (IsPureDieCutGroup(top, 0)) {
            *usedModeOut = "top";
            ArtVecPushUnique(dieCutGroups, top);
            ExtractDieCutsFromContainer(top, 0, dieCuts);
            for (int i = 1; i < topSel->count; i++) ArtVecPushUnique(contents, topSel->items[i]);
            return;
        }
    }

    /* 兜底无法区分时全部归入 contents 以便前端给出清晰提示 */
    for (int i = 0; i < topSel->count; i++) ArtVecPushUnique(contents, topSel->items[i]);
}

static AIRealRect ExpandRectByPt(const AIRealRect *r, double tolPt)
{
    AIRealRect out = *r;
    out.left   -= tolPt;
    out.right  += tolPt;
    out.top    += tolPt;
    out.bottom -= tolPt;
    if (out.left > out.right) {
        double mid = 0.5 * (r->left + r->right);
        out.left = out.right = mid;
    }
    if (out.bottom > out.top) {
        double mid = 0.5 * (r->bottom + r->top);
        out.bottom = out.top = mid;
    }
    return out;
}

static void ClearArtPaintForMask(AIArtHandle art, const AIPathStyle *emptyStyle)
{
    if (!art) return;
    if (N.artStyle && N.artStyle->SetArtStyle) {
        N.artStyle->SetArtStyle(art, NULL);
    }
    short type = 0;
    if (N.art->GetArtType(art, &type) != 0) return;
    if (type == kPathArt) {
        N.style->SetPathStyle(art, emptyStyle);
    } else if (type == kCompoundPathArt || type == kGroupArt) {
        AIArtHandle ch = NULL;
        if (N.art->GetArtFirstChild(art, &ch) == 0) {
            while (ch) {
                ClearArtPaintForMask(ch, emptyStyle);
                AIArtHandle nx = NULL;
                if (N.art->GetArtSibling(ch, &nx) != 0) break;
                ch = nx;
            }
        }
    }
}

/* 递归清理搬空后的原刀线编组, 非空组保留不动 */
static void DisposeIfEmptyGroup(AIArtHandle grp)
{
    if (!grp) return;
    short type = 0;
    if (N.art->GetArtType(grp, &type) != 0 || type != kGroupArt) return;
    AIArtHandle ch = NULL;
    if (N.art->GetArtFirstChild(grp, &ch) == 0) {
        while (ch) {
            AIArtHandle nx = NULL;
            N.art->GetArtSibling(ch, &nx);
            short ct = 0;
            if (N.art->GetArtType(ch, &ct) == 0 && ct == kGroupArt) {
                DisposeIfEmptyGroup(ch);
            }
            ch = nx;
        }
    }
    ch = NULL;
    if (N.art->GetArtFirstChild(grp, &ch) != 0 || !ch) {
        N.art->DisposeArt(grp);
    }
}

static void HandleBatchMaskInspect(const char *reqJson, StrBuf *out)
{
    AIDocumentHandle docH = NULL;
    if (N.doc->GetDocument(&docH) != 0 || !docH) {
        SbAppend(out, "{\"ok\":false,\"error\":\"请先打开文档。\"}");
        return;
    }

    char detectMode[32] = "auto";
    JsonGetStr(reqJson, "detectMode", detectMode, sizeof(detectMode));
    double tolMm = JsonGetNum(reqJson, "toleranceMm", 0.0);
    if (tolMm < -50.0) tolMm = -50.0;
    if (tolMm > 50.0)  tolMm = 50.0;
    double tolPt = tolMm * (72.0 / 25.4);

    ArtVec topSel = {0}, dieCuts = {0}, dieCutGroups = {0}, contents = {0};
    CollectTopSelectedArts(&topSel);
    const char *usedMode = "nofill";
    PartitionDieCutsAndContents(&topSel, detectMode, &dieCuts, &dieCutGroups, &contents, &usedMode);

    int matchedDieCuts = 0;
    int sharedContents = 0;
    if (dieCuts.count > 0 && contents.count > 0) {
        AIRealRect *cBoxes = (AIRealRect *)calloc((size_t)contents.count, sizeof(AIRealRect));
        int *cValid        = (int *)calloc((size_t)contents.count, sizeof(int));
        int *hitCount      = (int *)calloc((size_t)contents.count, sizeof(int));
        if (cBoxes && cValid && hitCount) {
            for (int j = 0; j < contents.count; j++) {
                cValid[j] = GetArtVisualBounds(contents.items[j], &cBoxes[j]);
            }
            for (int d = 0; d < dieCuts.count; d++) {
                AIRealRect dBox;
                if (!GetArtVisualBounds(dieCuts.items[d], &dBox)) continue;
                AIRealRect testBox = ExpandRectByPt(&dBox, tolPt);
                int hits = 0;
                for (int j = 0; j < contents.count; j++) {
                    if (!cValid[j]) continue;
                    if (RectsIntersect(&cBoxes[j], &testBox)) {
                        hitCount[j]++;
                        hits++;
                    }
                }
                if (hits > 0) matchedDieCuts++;
            }
            for (int j = 0; j < contents.count; j++) {
                if (hitCount[j] > 1) sharedContents++;
            }
        }
        free(cBoxes);
        free(cValid);
        free(hitCount);
    }

    SbAppend(out, "{\"ok\":true,\"data\":{");
    SbAppendFmt(out, "\"dieCutCount\":%d,\"contentCount\":%d,\"matchedDieCuts\":%d,\"sharedContents\":%d,\"usedMode\":",
        dieCuts.count, contents.count, matchedDieCuts, sharedContents);
    SbAppendJsonStr(out, usedMode);
    SbAppend(out, "}}");

    ArtVecFree(&topSel);
    ArtVecFree(&dieCuts);
    ArtVecFree(&dieCutGroups);
    ArtVecFree(&contents);
}

static void HandleBatchMaskRun(const char *reqJson, StrBuf *out)
{
    DWORD t0 = GetTickCount();
    AIDocumentHandle docH = NULL;
    if (N.doc->GetDocument(&docH) != 0 || !docH) {
        SbAppend(out, "{\"ok\":false,\"error\":\"请先打开文档。\"}");
        return;
    }

    char detectMode[32] = "auto";
    JsonGetStr(reqJson, "detectMode", detectMode, sizeof(detectMode));
    double tolMm  = JsonGetNum(reqJson, "toleranceMm", 0.0);
    int skipEmpty = JsonGetBool(reqJson, "skipEmpty", 1);
    if (tolMm < -50.0) tolMm = -50.0;
    if (tolMm > 50.0)  tolMm = 50.0;
    double tolPt = tolMm * (72.0 / 25.4);

    ArtVec topSel = {0}, dieCuts = {0}, dieCutGroups = {0}, contents = {0};
    CollectTopSelectedArts(&topSel);
    const char *usedMode = "nofill";
    PartitionDieCutsAndContents(&topSel, detectMode, &dieCuts, &dieCutGroups, &contents, &usedMode);

    if (dieCuts.count == 0) {
        SbAppend(out, "{\"ok\":false,\"error\":\"未识别到闭合刀线，请同时选中刀线和要蒙版的对象。\"}");
        ArtVecFree(&topSel); ArtVecFree(&dieCuts); ArtVecFree(&dieCutGroups); ArtVecFree(&contents);
        return;
    }
    if (contents.count == 0) {
        SbAppend(out, "{\"ok\":false,\"error\":\"未找到需要被蒙版的内容对象，请同时选中刀线和内容对象。\"}");
        ArtVecFree(&topSel); ArtVecFree(&dieCuts); ArtVecFree(&dieCutGroups); ArtVecFree(&contents);
        return;
    }

    int D = dieCuts.count;
    int C = contents.count;
    AIRealRect *cBoxes = (AIRealRect *)calloc((size_t)C, sizeof(AIRealRect));
    int *cValid        = (int *)calloc((size_t)C, sizeof(int));
    int *hitCount      = (int *)calloc((size_t)C, sizeof(int));
    int *usedCount     = (int *)calloc((size_t)C, sizeof(int));
    unsigned char *mat = (unsigned char *)calloc((size_t)D * (size_t)C, 1);
    int *dieHits       = (int *)calloc((size_t)D, sizeof(int));
    if (!cBoxes || !cValid || !hitCount || !usedCount || !mat || !dieHits) {
        free(cBoxes); free(cValid); free(hitCount); free(usedCount); free(mat); free(dieHits);
        ArtVecFree(&topSel); ArtVecFree(&dieCuts); ArtVecFree(&dieCutGroups); ArtVecFree(&contents);
        SbAppend(out, "{\"ok\":false,\"error\":\"内存不足。\"}");
        return;
    }

    for (int j = 0; j < C; j++) {
        cValid[j] = GetArtVisualBounds(contents.items[j], &cBoxes[j]);
    }
    for (int d = 0; d < D; d++) {
        AIRealRect dBox;
        if (!GetArtVisualBounds(dieCuts.items[d], &dBox)) continue;
        AIRealRect testBox = ExpandRectByPt(&dBox, tolPt);
        for (int j = 0; j < C; j++) {
            if (!cValid[j]) continue;
            if (RectsIntersect(&cBoxes[j], &testBox)) {
                mat[(size_t)d * (size_t)C + (size_t)j] = 1;
                hitCount[j]++;
                dieHits[d]++;
            }
        }
    }

    /* 设置 Undo 文案, 支持一次 Ctrl+Z 完整撤销 */
    if (N.undo) {
        UStr uUndo = {0}, uRedo = {0};
        if (Utf8ToUStr("撤销批量蒙版", &uUndo) && Utf8ToUStr("重做批量蒙版", &uRedo)) {
            N.undo->SetUndoTextUS(&uUndo, &uRedo);
        }
        if (uUndo.fImpl) N.ustr->Destroy(&uUndo);
        if (uRedo.fImpl) N.ustr->Destroy(&uRedo);
    }

    AIPathStyle emptyStyle;
    memset(&emptyStyle, 0, sizeof(emptyStyle));
    emptyStyle.fillPaint = 0;
    emptyStyle.strokePaint = 0;
    emptyStyle.fill.color.kind = kNoneColor;
    emptyStyle.stroke.color.kind = kNoneColor;
    emptyStyle.resolution = 800.0;

    ArtVec createdGroups = {0};
    int created = 0, skipped = 0, duplicated = 0, maskedItems = 0;
    AIErr lastErr = 0;

    for (int d = 0; d < D; d++) {
        if (dieHits[d] == 0 && skipEmpty) {
            skipped++;
            continue;
        }

        AIArtHandle dieCut = dieCuts.items[d];
        /* 原位锚点: 优先建在首个命中内容对象的正上方, 保留在内容原图层与堆叠位; 空刀线则建在原刀线上方 */
        AIArtHandle anchor = dieCut;
        for (int j = 0; j < C; j++) {
            if (mat[(size_t)d * (size_t)C + (size_t)j]) {
                anchor = contents.items[j];
                break;
            }
        }

        AIArtHandle grp = NULL;
        lastErr = N.art->NewArt(kGroupArt, kPlaceAbove, anchor, &grp);
        if (lastErr != 0 || !grp) break;

        /* 按原始堆叠顺序(从顶到底)依次放入剪切组底部, 100% 保持原图层前后关系 */
        for (int j = 0; j < C; j++) {
            if (!mat[(size_t)d * (size_t)C + (size_t)j]) continue;
            AIArtHandle obj = contents.items[j];
            usedCount[j]++;
            if (usedCount[j] < hitCount[j]) {
                AIArtHandle dup = NULL;
                if (N.art->DuplicateArt(obj, kPlaceInsideOnBottom, grp, &dup) == 0 && dup) {
                    duplicated++;
                    maskedItems++;
                }
            } else {
                if (N.art->ReorderArt(obj, kPlaceInsideOnBottom, grp) == 0) {
                    maskedItems++;
                }
            }
        }

        /* 直接用原刀线作为剪切蒙版路径(置于剪切组最顶层、清除填描、先设剪切组再设 kArtIsClipMask) */
        N.art->ReorderArt(dieCut, kPlaceInsideOnTop, grp);
        ClearArtPaintForMask(dieCut, &emptyStyle);
        N.group->SetGroupClipped(grp, 1);
        N.art->SetArtUserAttr(dieCut, kArtIsClipMask, kArtIsClipMask);
        N.art->SetArtBounds(dieCut);
        N.art->SetArtBounds(grp);

        ArtVecPushUnique(&createdGroups, grp);
        created++;
    }

    /* 清理已搬空的原刀线编组 */
    for (int g = 0; g < dieCutGroups.count; g++) {
        DisposeIfEmptyGroup(dieCutGroups.items[g]);
    }

    N.match->DeselectAll();
    for (int i = 0; i < createdGroups.count; i++) {
        SelectArtRecursive(createdGroups.items[i]);
    }
    N.doc->RedrawDocument();

    DWORD elapsed = GetTickCount() - t0;
    if (lastErr != 0 && created == 0) {
        SbAppendFmt(out, "{\"ok\":false,\"error\":\"批量蒙版失败（错误码 0x%08X）。\"}", (unsigned)lastErr);
    } else if (created == 0) {
        SbAppend(out, "{\"ok\":false,\"error\":\"没有刀线与内容对象存在重叠，未建立剪切蒙版。\"}");
    } else {
        SbAppend(out, "{\"ok\":true,\"data\":{");
        SbAppendFmt(out, "\"count\":%d,\"skipped\":%d,\"duplicated\":%d,\"maskedItems\":%d,\"dieCutCount\":%d,\"elapsedMs\":%lu,\"usedMode\":",
            created, skipped, duplicated, maskedItems, D, (unsigned long)elapsed);
        SbAppendJsonStr(out, usedMode);
        SbAppend(out, "}}");
    }

    free(cBoxes); free(cValid); free(hitCount); free(usedCount); free(mat); free(dieHits);
    ArtVecFree(&createdGroups);
    ArtVecFree(&topSel);
    ArtVecFree(&dieCuts);
    ArtVecFree(&dieCutGroups);
    ArtVecFree(&contents);
}

/* ---------------- WM_COPYDATA 总入口 (运行于 Illustrator 主线程) ---------------- */

YUNLI_NATIVE_API int __cdecl YunLiNativeHandleCopyData(const COPYDATASTRUCT *cds)
{
    if (!cds || cds->dwData != YUNLI_IPC_MAGIC || !cds->lpData || cds->cbData < 4) return 0;

    /* 负载格式: L"<reqPath>|<resPath>" */
    size_t wlen = cds->cbData / sizeof(wchar_t);
    wchar_t *copy = (wchar_t *)malloc((wlen + 1) * sizeof(wchar_t));
    if (!copy) return 0;
    memcpy(copy, cds->lpData, wlen * sizeof(wchar_t));
    copy[wlen] = 0;

    wchar_t *sep = wcschr(copy, L'|');
    if (!sep) { free(copy); return 0; }
    *sep = 0;
    const wchar_t *reqPath = copy;
    const wchar_t *resPath = sep + 1;

    StrBuf out = {0};
    char *reqJson = ReadFileUtf8(reqPath);
    if (!reqJson) {
        SbAppend(&out, "{\"ok\":false,\"error\":\"无法读取原生请求文件。\"}");
    } else if (!EnsureSuites()) {
        SbAppend(&out, "{\"ok\":false,\"error\":\"当前 Illustrator 版本缺少所需原生 SDK 套件。\"}");
    } else {
        char action[64] = {0};
        JsonGetStr(reqJson, "action", action, sizeof(action));

        AIAppContextHandle appCtx = NULL;
        int pushed = (N.ctx && N.ctx->PushAppContext(N.self, &appCtx) == 0 && appCtx != NULL);

        if (strcmp(action, "splitInspect") == 0)           HandleSplitInspect(&out);
        else if (strcmp(action, "splitRun") == 0)          HandleSplitRun(reqJson, &out);
        else if (strcmp(action, "batchMaskInspect") == 0)  HandleBatchMaskInspect(reqJson, &out);
        else if (strcmp(action, "batchMaskRun") == 0)      HandleBatchMaskRun(reqJson, &out);
        else if (strcmp(action, "spotSelectInspect") == 0) HandleSpotSelectInspect(&out);
        else if (strcmp(action, "spotSelectRun") == 0)     HandleSpotSelectRun(reqJson, &out);
        else SbAppend(&out, "{\"ok\":false,\"error\":\"不支持的原生操作。\"}");

        if (pushed) N.ctx->PopAppContext(appCtx);
    }

    if (out.buf) WriteFileUtf8(resPath, out.buf, out.len);
    free(out.buf);
    free(reqJson);
    free(copy);
    return 1;
}

BOOL WINAPI DllMain(HINSTANCE hinstDLL, DWORD fdwReason, LPVOID lpvReserved)
{
    (void)hinstDLL;
    (void)fdwReason;
    (void)lpvReserved;
    return TRUE;
}
