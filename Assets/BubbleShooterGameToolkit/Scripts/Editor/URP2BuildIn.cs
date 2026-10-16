// // ©2015 - 2023 Candy Smith
// // All rights reserved
// // Redistribution of this software is strictly not allowed.
// // Copy of this software can be obtained from unity asset store only.
// // THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// // IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// // FITNESS FOR A PARTICULAR PURPOSE AND NON-INFRINGEMENT. IN NO EVENT SHALL THE
// // AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// // LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// // OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// // THE SOFTWARE.

using System.Collections.Generic;
using UnityEditor;
using UnityEngine;

namespace BubbleShooterGameToolkit.Scripts.Editor
{
    public class MaterialUpdater : EditorWindow
    {
        private Material standardSpriteMaterial;
        private Shader replacementShader;

        [MenuItem("Tools/URP 2 Build-In")]
        public static void ShowWindow()
        {
            GetWindow<MaterialUpdater>("Material Updater");
        }

        private void OnGUI()
        {
            GUILayout.Label("Material Updater", EditorStyles.boldLabel);

            standardSpriteMaterial = (Material)EditorGUILayout.ObjectField("Standard Sprite Material", standardSpriteMaterial, typeof(Material), false);

            if (GUILayout.Button("Update SpriteRenderer Materials"))
            {
                if (standardSpriteMaterial == null)
                {
                    EditorUtility.DisplayDialog("Error", "Please assign the standard sprite material.", "OK");
                    return;
                }
                UpdateSpriteMaterials();
            }

            GUILayout.Space(20);

            replacementShader = (Shader)EditorGUILayout.ObjectField("Replacement Shader", replacementShader, typeof(Shader), false);

            if (GUILayout.Button("Find Materials with Shader Errors"))
            {
                FindMaterialsWithShaderErrors();
            }
        }

        private void UpdateSpriteMaterials()
        {
            string[] prefabGuids = AssetDatabase.FindAssets("t:Prefab");
            List<string> updatedPrefabs = new List<string>();

            foreach (string guid in prefabGuids)
            {
                string assetPath = AssetDatabase.GUIDToAssetPath(guid);
                GameObject prefab = AssetDatabase.LoadAssetAtPath<GameObject>(assetPath);

                if (prefab != null)
                {
                    bool prefabModified = false;
                    SpriteRenderer[] spriteRenderers = prefab.GetComponentsInChildren<SpriteRenderer>(true);

                    foreach (SpriteRenderer spriteRenderer in spriteRenderers)
                    {
                        if (spriteRenderer.sharedMaterial == null)
                        {
                            spriteRenderer.sharedMaterial = standardSpriteMaterial;
                            prefabModified = true;
                        }
                    }

                    if (prefabModified)
                    {
                        PrefabUtility.SavePrefabAsset(prefab);
                        updatedPrefabs.Add(assetPath);
                    }
                }
            }

            if (updatedPrefabs.Count > 0)
            {
                Debug.Log($"Updated {updatedPrefabs.Count} prefabs:");
                foreach (string path in updatedPrefabs)
                {
                    Debug.Log(path);
                }
            }
            else
            {
                Debug.Log("No prefabs were updated.");
            }

            AssetDatabase.Refresh();
        }

        private void FindMaterialsWithShaderErrors()
        {
            string[] materialGuids = AssetDatabase.FindAssets("t:Material");
            List<string> errorMaterials = new List<string>();

            foreach (string guid in materialGuids)
            {
                string assetPath = AssetDatabase.GUIDToAssetPath(guid);
                Material material = AssetDatabase.LoadAssetAtPath<Material>(assetPath);

                if (material != null && material.shader.name == "Hidden/InternalErrorShader")
                {
                    errorMaterials.Add(assetPath);
                }
            }

            if (errorMaterials.Count > 0)
            {
                Debug.Log($"Found {errorMaterials.Count} materials with shader errors:");
                foreach (string path in errorMaterials)
                {
                    Debug.Log(path);
                }

                if (replacementShader != null)
                {
                    bool replace = EditorUtility.DisplayDialog("Replace Shaders", 
                        $"Do you want to replace the shader for {errorMaterials.Count} materials with shader errors?", 
                        "Yes", "No");

                    if (replace)
                    {
                        ReplaceShadersWithErrors(errorMaterials);
                    }
                }
                else
                {
                    Debug.Log("No replacement shader specified. Shaders were not replaced.");
                }
            }
            else
            {
                Debug.Log("No materials with shader errors found.");
            }
        }

        private void ReplaceShadersWithErrors(List<string> errorMaterials)
        {
            int replacedCount = 0;

            foreach (string path in errorMaterials)
            {
                Material material = AssetDatabase.LoadAssetAtPath<Material>(path);
                if (material != null)
                {
                    material.shader = replacementShader;
                    EditorUtility.SetDirty(material);
                    replacedCount++;
                }
            }

            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh();

            Debug.Log($"Replaced shaders for {replacedCount} materials with shader errors.");
        }
    }
}