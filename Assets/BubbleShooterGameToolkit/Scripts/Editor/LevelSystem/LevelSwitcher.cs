using BubbleShooterGameToolkit.Scripts.LevelSystem;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.UIElements;

namespace BubbleShooterGameToolkit.Scripts.Editor.LevelSystem
{
    public class LevelSwitcher : VisualElement
    {
        private readonly SerializedObject levelSerializedObject;
        private readonly LevelEditor levelEditor;
        private readonly Level level;
        private int prevSizeY;

        public LevelSwitcher(SerializedObject levelSerializedObject, Level level, LevelEditor levelEditor)
        {
            this.levelEditor = levelEditor;
            this.levelSerializedObject = levelSerializedObject;
            this.level = level;
            Draw(AssetDatabase.LoadAssetAtPath<VisualTreeAsset>("Assets/BubbleShooterGameToolkit/UIBuilder/LevelSwitcher.uxml").CloneTree());
        }
        
        private void Draw(TemplateContainer visualTree)
        {
            visualTree.Q<Button>("PlayButton").clickable.clicked += PlayLevel;
            visualTree.Q<Button>("PrevLevel").clickable.clicked += OpenPrevLevel;
            visualTree.Q<Button>("NextLevel").clickable.clicked += OpenNextLevel;
            visualTree.Q<Button>("NewLevel").clickable.clicked += NewLevel;
            var levelNumberField = visualTree.Q<IntegerField>("LevelNum");
            levelNumberField.value = levelEditor.num;
            levelNumberField.RegisterCallback<KeyDownEvent>(evt =>
            {
                if (evt.keyCode == KeyCode.Return || evt.keyCode == KeyCode.KeypadEnter)
                    levelEditor.LoadLevel(levelNumberField.value);
            });
            
            this.Add(visualTree);

            void OpenPrevLevel()
            {
                if (levelEditor.num > 1)
                {
                    levelEditor.LoadLevel(levelEditor.num - 1);
                }
            }

            void OpenNextLevel()
            {
                if (levelEditor.num < Resources.LoadAll<Level>("Levels").Length)
                {
                    levelEditor.LoadLevel(levelEditor.num + 1);
                }
            }
        }
        
        private void PlayLevel()
        {
            if (EditorApplication.isPlaying)
            {
                EditorApplication.isPlaying = false;
            }
            else
            {
                levelEditor.Save();
                PlayerPrefs.SetInt("OpenLevel", levelEditor.num);
                PlayerPrefs.SetString("OpenLevelName", level.name);
                PlayerPrefs.Save();
                EditorSceneManager.OpenScene("Assets/BubbleShooterGameToolkit/Scenes/game.unity");
                EditorApplication.isPlaying = true;
            }
        }

        private void NewLevel()
        {
            var levelsNum = GetLevels().Length + 1;
            var instance = ScriptableObject.CreateInstance<Level>();
            instance.name = "Level_" + levelsNum;
            // instance.targets = level.targets;
            string assetPathAndName = AssetDatabase.GenerateUniqueAssetPath("Assets/BubbleShooterGameToolkit/Resources/Levels/Level_" + levelsNum + ".asset");
            AssetDatabase.CreateAsset(instance, assetPathAndName);
            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh();
            Selection.activeObject = instance;
        }
        
        private Level[] GetLevels()
        {
            return Resources.LoadAll<Level>("Levels");
        }
    }
}