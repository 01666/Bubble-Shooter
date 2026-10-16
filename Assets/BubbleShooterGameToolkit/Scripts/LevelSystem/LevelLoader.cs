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

using System;
using BubbleShooterGameToolkit.Scripts.System;
using UnityEngine;

namespace BubbleShooterGameToolkit.Scripts.LevelSystem
{
    public class LevelLoader : Singleton<LevelLoader>
    {
        public static Action OnLevelLoaded;

        // Current loaded level
        public Level CurrentLevel { get; private set; }
        public Level LoadLevel(int num)
        {
            CurrentLevel = Resources.Load<Level>("Levels/Level_" + num);
            return CurrentLevel;
        }
        
        // 本项目不需要推进关卡：进入战斗场景时始终加载这一关。
        // 想换关卡只需改这个数字（对应 Resources/Levels/Level_N）。
        private const int ForcedLevelNumber = 1;

        public void LoadLevel(Level levelToLoad = null)
        {
            CurrentLevel = levelToLoad;
            if (CurrentLevel != null)
                return;
            // 关卡编辑器“试玩本关”会用 OpenLevelName 指定关卡，保留该能力
            var levelName = PlayerPrefs.GetString("OpenLevelName");
            if (!string.IsNullOrEmpty(levelName))
            {
                CurrentLevel = Resources.Load<Level>("Levels/"+levelName);
                PlayerPrefs.DeleteKey("OpenLevelName");
            }
            else
            {
                // 不推进关卡：忽略地图/进度，始终加载同一关
                CurrentLevel = LoadLevel(ForcedLevelNumber);
            }
            OnLevelLoaded?.Invoke();
        }
    }
}