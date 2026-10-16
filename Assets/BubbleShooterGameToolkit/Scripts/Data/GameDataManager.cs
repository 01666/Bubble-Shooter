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
using BubbleShooterGameToolkit.Scripts.Gameplay.Managers;
using BubbleShooterGameToolkit.Scripts.System;
using UnityEngine;

namespace BubbleShooterGameToolkit.Scripts.Data
{
    public class GameDataManager : SingletonBehaviour<GameDataManager>
    {
        [HideInInspector]
        public int Level;

        private void OnEnable()
        {
            UpdateLevel();
            EventManager.GetEvent(EGameEvent.Map).Subscribe(UpdateLevel);
        }
        
        private void OnDisable()
        {
            EventManager.GetEvent(EGameEvent.Map).UnSubscribe(UpdateLevel);
        }

        private void UpdateLevel()
        {
            Level = PlayerPrefs.GetInt("Level", 1);
        }

        public void SaveLevel(int levelNumber, int score)
        {
            Level = levelNumber + 1;
            var levellast = PlayerPrefs.GetInt("Level", 1);
            if (levellast < Level)
                PlayerPrefs.SetInt("Level", Math.Max(levellast, Level));
            if (PlayerPrefs.GetInt("LevelScore" + levelNumber, 0) < score)
                PlayerPrefs.SetInt("LevelScore" + levelNumber, score);
            PlayerPrefs.Save();
            
        }
    }
}