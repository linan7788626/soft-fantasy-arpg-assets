// Optional editor-only utilities. No network, runtime, URP or third-party dependencies.
// Target APIs: Unity 2022.3 / Unity 6.0. Validate in your project's Editor version.
using System;
using System.Collections.Generic;
using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace Nli.SoftFantasy.EditorTools
{
    public sealed class NliSoftFantasyBrowser : EditorWindow
    {
        private const string Root = "Assets/NLI_SoftFantasy_ARPG";
        private const string SpritesRoot = Root + "/Sprites";
        private readonly List<Sprite> sprites = new List<Sprite>();
        private Vector2 scroll;
        private string query = "";

        [MenuItem("Tools/NLI Soft Fantasy/Open Asset Browser")]
        public static void OpenBrowser()
        {
            var window = GetWindow<NliSoftFantasyBrowser>("NLI Soft Fantasy");
            window.minSize = new Vector2(420, 320);
            window.Reload();
        }

        private void OnEnable() { Reload(); }

        private static List<Sprite> LoadSprites()
        {
            return AssetDatabase.FindAssets("t:Sprite", new[] { SpritesRoot })
                .Select(AssetDatabase.GUIDToAssetPath)
                .OrderBy(path => path, StringComparer.Ordinal)
                .Select(AssetDatabase.LoadAssetAtPath<Sprite>)
                .Where(sprite => sprite != null).ToList();
        }

        private void Reload()
        {
            sprites.Clear();
            sprites.AddRange(LoadSprites());
            Repaint();
        }

        private void OnGUI()
        {
            EditorGUILayout.LabelField("NLI Soft Fantasy ARPG / Art Upgrade v0.2.1", EditorStyles.boldLabel);
            EditorGUILayout.LabelField("Style: NL-ARPG-SOFT-766DF2B7");
            EditorGUILayout.HelpBox("219 individually redrawn assets plus 4 approved originals and 1 new NPC elder. Native PNG pixels and alpha preserved. Animation continuity, tile seams, scene scale and Editor import need separate validation.", MessageType.Info);
            using (new EditorGUILayout.HorizontalScope())
            {
                query = EditorGUILayout.TextField("Filter", query);
                if (GUILayout.Button("Refresh", GUILayout.Width(70))) Reload();
            }
            var filtered = sprites.Where(s => s.name.IndexOf(query ?? "", StringComparison.OrdinalIgnoreCase) >= 0).ToList();
            EditorGUILayout.LabelField(filtered.Count + " sprites");
            int columns = Mathf.Max(1, Mathf.FloorToInt((position.width - 24) / 132f));
            scroll = EditorGUILayout.BeginScrollView(scroll);
            for (int i = 0; i < filtered.Count; i += columns)
            {
                using (new EditorGUILayout.HorizontalScope())
                {
                    for (int j = i; j < Mathf.Min(i + columns, filtered.Count); j++)
                    {
                        var sprite = filtered[j];
                        using (new EditorGUILayout.VerticalScope(EditorStyles.helpBox, GUILayout.Width(124)))
                        {
                            Rect rect = GUILayoutUtility.GetRect(116, 104, GUILayout.Width(116), GUILayout.Height(104));
                            EditorGUI.DrawRect(rect, new Color(0.23f, 0.25f, 0.29f));
                            if (sprite.texture != null) GUI.DrawTexture(rect, sprite.texture, ScaleMode.ScaleToFit, true);
                            GUILayout.Label(sprite.name, EditorStyles.miniLabel, GUILayout.Width(116));
                            if (GUILayout.Button("Select", GUILayout.Width(116)))
                            {
                                Selection.activeObject = sprite;
                                EditorGUIUtility.PingObject(sprite);
                            }
                        }
                    }
                }
            }
            EditorGUILayout.EndScrollView();
        }

        [MenuItem("Tools/NLI Soft Fantasy/Apply Sprite Import Settings")]
        public static void ApplySpriteImportSettings()
        {
            if (!EditorUtility.DisplayDialog("Reset NLI sprite import settings?",
                "This changes only PNGs in " + SpritesRoot + ". Existing custom import settings for those files will be replaced. See README for defaults.", "Apply", "Cancel")) return;
            string[] guids = AssetDatabase.FindAssets("t:Texture2D", new[] { SpritesRoot });
            try
            {
                for (int i = 0; i < guids.Length; i++)
                {
                    string path = AssetDatabase.GUIDToAssetPath(guids[i]);
                    if (!(AssetImporter.GetAtPath(path) is TextureImporter importer)) continue;
                    EditorUtility.DisplayProgressBar("NLI Sprite Settings", path, (float)i / Mathf.Max(1, guids.Length));
                    importer.textureType = TextureImporterType.Sprite;
                    importer.spriteImportMode = SpriteImportMode.Single;
                    importer.spritePixelsPerUnit = 100f;
                    importer.mipmapEnabled = false;
                    importer.sRGBTexture = true;
                    importer.filterMode = FilterMode.Bilinear;
                    importer.wrapMode = TextureWrapMode.Clamp;
                    importer.alphaSource = TextureImporterAlphaSource.FromInput;
                    importer.alphaIsTransparency = true;
                    importer.textureCompression = TextureImporterCompression.Uncompressed;
                    importer.npotScale = TextureImporterNPOTScale.None;
                    importer.maxTextureSize = 4096;
                    var settings = new TextureImporterSettings();
                    importer.ReadTextureSettings(settings);
                    settings.spriteAlignment = (int)SpriteAlignment.Center;
                    settings.spritePivot = new Vector2(0.5f, 0.5f);
                    settings.spriteMeshType = SpriteMeshType.FullRect;
                    importer.SetTextureSettings(settings);
                    importer.SaveAndReimport();
                }
            }
            finally { EditorUtility.ClearProgressBar(); }
            Debug.Log("NLI sprite import settings applied. Review textures at your target display scale.");
        }

        [MenuItem("Tools/NLI Soft Fantasy/Create Gallery Scene")]
        public static void CreateGalleryScene()
        {
            var items = LoadSprites();
            if (items.Count == 0)
            {
                EditorUtility.DisplayDialog("No sprites found", "Import the Sprites folder first, then apply sprite import settings if necessary.", "OK");
                return;
            }
            // Additive creation does not discard any existing unsaved scene.
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Additive);
            SceneManager.SetActiveScene(scene);
            var root = new GameObject("NLI Static Sprite Gallery");
            const int columns = 12;
            const float pitch = 2.25f;
            int rows = Mathf.CeilToInt(items.Count / (float)columns);
            for (int i = 0; i < items.Count; i++)
            {
                var go = new GameObject(items[i].name);
                go.transform.SetParent(root.transform, false);
                go.transform.localPosition = new Vector3((i % columns) * pitch, -(i / columns) * pitch, 0);
                var renderer = go.AddComponent<SpriteRenderer>();
                renderer.sprite = items[i];
                float largest = Mathf.Max(items[i].bounds.size.x, items[i].bounds.size.y);
                if (largest > 0f) go.transform.localScale = Vector3.one * Mathf.Min(1f, 1.9f / largest);
            }
            var cameraObject = new GameObject("Gallery Camera");
            var camera = cameraObject.AddComponent<Camera>();
            cameraObject.tag = "MainCamera";
            camera.orthographic = true;
            camera.clearFlags = CameraClearFlags.SolidColor;
            camera.backgroundColor = new Color(0.18f, 0.20f, 0.24f);
            camera.orthographicSize = Mathf.Max(rows * pitch * 0.5f, columns * pitch * 0.5f) + 1f;
            cameraObject.transform.position = new Vector3((columns - 1) * pitch * 0.5f, -(rows - 1) * pitch * 0.5f, -10);
            Selection.activeObject = root;
            EditorSceneManager.MarkSceneDirty(scene);
            if (SceneView.lastActiveSceneView != null) SceneView.lastActiveSceneView.FrameSelected();
            Debug.Log("NLI gallery created as an unsaved additive scene. Save it manually if desired. It is a static catalog, not a game demo.");
        }
    }
}
