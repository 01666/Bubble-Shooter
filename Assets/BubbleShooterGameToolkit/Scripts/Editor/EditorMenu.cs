// // ©2015 - 2024 Candy Smith
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

using BubbleShooterGameToolkit.Scripts.LevelSystem;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace BubbleShooterGameToolkit.Scripts.Editor
{
    [InitializeOnLoad]
    public static class EditorMenu
    {
        [MenuItem("Tools/Bubble Shooter/Scenes/Main scene &1", priority = 0)]
        public static void MainScene()
        {
            EditorSceneManager.OpenScene($"Assets/BubbleShooterGameToolkit/Scenes/main.unity");
        }

        [MenuItem("Tools/Bubble Shooter/Scenes/Map scene &2")]
        public static void MapScene()
        {
            EditorSceneManager.OpenScene($"Assets/BubbleShooterGameToolkit/Scenes/map.unity");
        }

        [MenuItem("Tools/Bubble Shooter/Scenes/Game scene &3")]
        public static void GameScene()
        {
            EditorSceneManager.OpenScene($"Assets/BubbleShooterGameToolkit/Scenes/game.unity");
        }

        [MenuItem("Tools/Bubble Shooter/Scenes/TEST scene &4")]
        public static void TestScene()
        {
            EditorSceneManager.OpenScene($"Assets/BubbleShooterGameToolkit/Scenes/test.unity");
        }

        [MenuItem("Tools/Bubble Shooter/Level editor/Editor _C", priority = 1)]
        public static void LevelEditor()
        {
            Selection.activeObject = AssetDatabase.LoadMainAssetAtPath("Assets/BubbleShooterGameToolkit/Resources/Levels/Level_1.asset");
        }

        [MenuItem("Tools/Bubble Shooter/Documentation/Main", priority = 2)]
        public static void MainDoc()
        {
            Application.OpenURL("https://candy-smith.gitbook.io/bubble-shooter-toolkit/");
        }

        [MenuItem("Tools/Bubble Shooter/Documentation/ADS/Unity ads")]
        public static void UnityadsDoc()
        {
            Application.OpenURL("https://docs.google.com/document/d/1HeN8JtQczTVetkMnd8rpSZp_TZZkEA7_kan7vvvsMw0/edit");
        }

        [MenuItem("Tools/Bubble Shooter/Documentation/ADS/Google mobile ads(admob)")]
        public static void AdmobDoc()
        {
            Application.OpenURL("https://docs.google.com/document/d/1I69mo9yLzkg35wtbHpsQd3Ke1knC5pf7G1Wag8MdO-M/edit");
        }

        [MenuItem("Tools/Bubble Shooter/Documentation/Unity IAP (in-apps)")]
        public static void Inapp()
        {
            Application.OpenURL("https://docs.google.com/document/d/1HeN8JtQczTVetkMnd8rpSZp_TZZkEA7_kan7vvvsMw0/edit#heading=h.60xg5ccbex9m");
        }

        [MenuItem("Tools/Bubble Shooter/Settings/Boost settings")]
        public static void BoostSettings()
        {
            Selection.activeObject = AssetDatabase.LoadMainAssetAtPath("Assets/BubbleShooterGameToolkit/Resources/Settings/BoostSettings.asset");
        }

        [MenuItem("Tools/Bubble Shooter/Settings/Debug settings")]
        public static void DebugSettings()
        {
            Selection.activeObject = AssetDatabase.LoadMainAssetAtPath("Assets/BubbleShooterGameToolkit/Resources/Settings/DebugSettings.asset");
        }

        [MenuItem("Tools/Bubble Shooter/Settings/Game settings", priority = 3)]
        public static void GameSettings()
        {
            Selection.activeObject = AssetDatabase.LoadMainAssetAtPath("Assets/BubbleShooterGameToolkit/Resources/Settings/GameSettings.asset");
        }

        [MenuItem("Tools/Bubble Shooter/Settings/Gameplay settings")]
        public static void GameplaySettings()
        {
            Selection.activeObject = AssetDatabase.LoadMainAssetAtPath("Assets/BubbleShooterGameToolkit/Resources/Settings/GameplaySettings.asset");
        }

        [MenuItem("Tools/Bubble Shooter/Settings/Target settings")]
        public static void TargetSettings()
        {
            Selection.activeObject = AssetDatabase.LoadMainAssetAtPath("Assets/BubbleShooterGameToolkit/Resources/Targets/Balls.asset");
        }

        [MenuItem("Tools/Bubble Shooter/Settings/Coins Shop settings")]
        public static void ShopSettings()
        {
            Selection.activeObject = AssetDatabase.LoadMainAssetAtPath("Assets/BubbleShooterGameToolkit/Resources/Settings/ShopSettings.asset");
        }

        [MenuItem("Tools/Bubble Shooter/Settings/Power settings")]
        public static void PowerSettings()
        {
            Selection.activeObject = AssetDatabase.LoadMainAssetAtPath("Assets/BubbleShooterGameToolkit/Resources/Settings/PowerSettings.asset");
        }

        [MenuItem("Tools/Bubble Shooter/Settings/Lucky spin settings")]
        public static void SpinSettings()
        {
            Selection.activeObject = AssetDatabase.LoadMainAssetAtPath("Assets/BubbleShooterGameToolkit/Resources/Settings/SpinSettings.asset");
        }

        [MenuItem("Tools/Bubble Shooter/Settings/Daily bonus settings")]
        public static void DailyBonusSettings()
        {
            Selection.activeObject = AssetDatabase.LoadMainAssetAtPath("Assets/BubbleShooterGameToolkit/Resources/Settings/DailyBonusSettings.asset");
        }

        [MenuItem("Tools/Bubble Shooter/Settings/Ads settings")]
        public static void AdsSettings()
        {
            Selection.activeObject = AssetDatabase.LoadMainAssetAtPath("Assets/BubbleShooterGameToolkit/Resources/Settings/AdsSettings.asset");
        }

        [MenuItem("Tools/Bubble Shooter/Reset PlayerPrefs")]
        private static void ResetPlayerPrefs()
        {
            PlayerPrefs.DeleteAll();
            Debug.Log("PlayerPrefs are reset");
        }
        
        //open all levels
        [MenuItem("Tools/Bubble Shooter/Level editor/Open all levels")]
        public static void OpenAllLevels()
        {
            var levels = Resources.LoadAll<Level>("Levels");
            PlayerPrefs.SetInt("Level", levels.Length);
            PlayerPrefs.Save();
            Debug.Log("All levels are open now");
        }
    }
}