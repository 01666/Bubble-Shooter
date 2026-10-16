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
using System.Collections.Generic;
using System.Linq;
using BubbleShooterGameToolkit.Scripts.CommonUI;
using BubbleShooterGameToolkit.Scripts.CommonUI.Popups;
using BubbleShooterGameToolkit.Scripts.Data;
using BubbleShooterGameToolkit.Scripts.System;
using DG.Tweening;
using UnityEngine;

namespace BubbleShooterGameToolkit.Scripts.Map
{
    public class MapManager : SingletonBehaviour<MapManager>
    {
        [SerializeField] private GameObject avatar;
        private List<LevelPin> openedLevels = new List<LevelPin>();
        public Action<int> OnAvatarComplete;

        [SerializeField]
        private GameObject circlePrefab;
        
        [SerializeField]
        private Transform levelsGrid;
        
        public static Action<Vector2> OnLastLevelPosition;
       

        private void Start()
        {
            var lvls = FindObjectsOfType<LevelPin>().OrderBy(x => x.number).ToArray();
            var lastLevel = PlayerPrefs.GetInt("Level", 1);
            foreach (var levelPin in lvls)
            {
                if (levelPin.number > lastLevel)
                    levelPin.Lock();
                else
                {
                    openedLevels.Add(levelPin);
                    levelPin.SetScore(PlayerPrefs.GetInt("LevelScore" + levelPin.number, 0));
                }
            }
            OnLastLevelPosition?.Invoke(openedLevels[^1].transform.position);
            Instantiate(circlePrefab,openedLevels[^1].transform.position, Quaternion.identity, levelsGrid);
            MoveAvatar();
        }

        private void MoveAvatar()
        {
            if (openedLevels.Count >= 2)
            {
                MoveAvatarToLevel(openedLevels[^2], 0);
                MoveAvatarToLevel(openedLevels[^1], 1, () => AvatarComplete(openedLevels[^1].number));
            }
            else
                MoveAvatarToLevel(openedLevels[^1], 0);
        }

        void MoveAvatarToLevel(LevelPin levelPin, float duration, TweenCallback tweenCallback = null)
        {
            avatar.transform.DOLocalMove( avatar.transform.parent.InverseTransformPoint(levelPin.avatarPivot.position), duration).OnComplete(tweenCallback);
        }

        private void AvatarComplete(int num)
        {
            OnAvatarComplete?.Invoke(num);
        }

        public void OpenLevel(int number)
        {
            PlayerPrefs.SetInt("OpenLevel", number);
            if (MenuManager.instance.GetPopupOpened<MenuPlay>())
                return;
            MenuManager.instance.ShowPopup<MenuPlay>(null, result =>
            {
                if (result == EPopupResult.Continue)
                    SceneLoader.instance.StartGameScene();
            });
        }
    }
}