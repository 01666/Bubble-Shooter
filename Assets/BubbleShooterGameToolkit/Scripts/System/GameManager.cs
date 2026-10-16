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
using System.Globalization;
using System.Linq;
using BubbleShooterGameToolkit.Scripts.CommonUI;
using BubbleShooterGameToolkit.Scripts.CommonUI.Daily;
using BubbleShooterGameToolkit.Scripts.CommonUI.Popups;
using BubbleShooterGameToolkit.Scripts.Data;
using BubbleShooterGameToolkit.Scripts.Enums;
using BubbleShooterGameToolkit.Scripts.Gameplay.Boosts;
using BubbleShooterGameToolkit.Scripts.Gameplay.Managers;
using BubbleShooterGameToolkit.Scripts.LevelSystem;
using BubbleShooterGameToolkit.Scripts.Map;
using BubbleShooterGameToolkit.Scripts.Services;
using BubbleShooterGameToolkit.Scripts.Settings;
using DG.Tweening;
using UnityEngine;
using UnityEngine.SceneManagement;
using Event = UnityEngine.Event;

namespace BubbleShooterGameToolkit.Scripts.System
{
    public class GameManager : SingletonBehaviour<GameManager>
    {
        public Coins coins;
        public Life life;
        public GameplaySettings GameplaySettings { get; private set; }
        public GameSettings GameSettings { get; private set; }
        
        public Action<int> purchaseSucceded;
        private ShopItemEditor[] shopItems;

        public override void Awake()
        {
            base.Awake();
            DontDestroyOnLoad(this);
            Application.targetFrameRate = 60;
            shopItems = Resources.Load<ShopSettings>("Settings/ShopSettings").shopItems;
            GameSettings = Resources.Load<GameSettings>("Settings/GameSettings");
            GameplaySettings = Resources.Load<GameplaySettings>("Settings/GameplaySettings");
            FindObjectOfType<LifeRefillTimer>()?.Init(GameSettings.MaxLife, GameSettings.TotalTimeForRestLifeHours * 3600 + GameSettings.TotalTimeForRestLifeMin * 60 + GameSettings.TotalTimeForRestLifeSec, life);
            BoostManager.instance.Init();
            DOTween.SetTweensCapacity (1250, 512);
            LevelLoader.ResetInstance();
            EventManager.SetGameStatus(EStatus.Init);
        }

        private void Start()
        {
            // Load resources from PlayerPrefs
            coins.LoadPrefs();
            life.LoadPrefs();
            IAPManager.instance?.InitializePurchasing(shopItems.Select(i => i.productID).ToArray());
            InitializeGamingServices.instance?.Initialize(() => IAPManager.instance.InitializePurchasing(shopItems.Select(i => i.productID).ToArray()), null);
        }

        public void InitManagers()
        {
            BoostManager.ResetInstance();
            ColorManager.ResetInstance();
            
            ColorManager.instance.Init();

            var levelManager = FindObjectOfType<LevelManager>();
            levelManager.InitGame();
        }

        private void SubscribeToAvatarComplete()
        {
            if (MapManager.instance != null)
            {
                MapManager.instance.OnAvatarComplete += AvatarComplete;
            }
        }

        private void UnsubscribeFromAvatarComplete()
        {
            if (MapManager.instance != null)
            {
                MapManager.instance.OnAvatarComplete -= AvatarComplete;
            }
        }

        private void OnEnable()
        {
            IAPManager.SubscribeToPurchaseEvent(PurchaseSucceded);
            SceneLoader.OnSceneLoadedCallback += OnSceneLoaded;
        }

        private void OnDisable()
        {
            IAPManager.UnsubscribeFromPurchaseEvent(PurchaseSucceded);
            SceneLoader.OnSceneLoadedCallback -= OnSceneLoaded;
        }

        private void OnSceneLoaded(Scene scene)
        {
            var loading = MenuManager.instance.GetPopupOpened<Loading>();
            if (loading == null)
            {
                SceneHandle(scene);
            }
            else
            {
                loading.OnCloseAction = (x) => { SceneHandle(scene); };
            }
        }

        private void SceneHandle(Scene scene)
        {
            if (scene.name == "game")
            {
                HandleGameScene();
            }
            else if (scene.name == "map")
            {
                HandleMapScene();
            }
        }

        private void HandleGameScene()
        {
            if (PlayerPrefs.GetInt("test", 0) == 1)
            {
                PlayerPrefs.SetInt("test", 0);
                return;
            }

            LevelLoader.ResetInstance();
            LevelLoader.instance.LoadLevel();
            InitManagers();
            UnsubscribeFromAvatarComplete();
        }

        public void HandleMapScene()
        {
            EventManager.SetGameStatus(EStatus.Map);
            
            if (PlayerPrefs.GetInt("test", 0) == 1)
            {
                PlayerPrefs.SetInt("test", 0);
            }

            SubscribeToAvatarComplete();

            bool shouldShowDailyBonus = CheckDailyBonusConditions();

            if (shouldShowDailyBonus)
            {
                MenuManager.instance.ShowPopup<DailyBonus>();
            }
        }

        private void AvatarComplete(int num)
        {
            if (Resources.Load<GameSettings>("Settings/GameSettings").openMenuPlay)
            {
                MapManager.instance.OpenLevel(num);
            }
        }

        public void RestartLevel()
        {
            if(life.IsEnough(1))
                SceneLoader.instance.StartGameScene();
            else
            {
                var lifeShop = MenuManager.instance.ShowPopup<LifeShop>();
                lifeShop.OnCloseAction += result =>
                {
                    if (result == EPopupResult.Continue)
                    {
                        SceneLoader.instance.StartGameScene();
                    }
                    else
                    {
                        SceneLoader.instance.GoToMap();
                    }
                };
            }
        }

        private void PurchaseSucceded(string id)
        {
            var count = shopItems.First(i => i.productID == id).coins;
            coins.Add(count);
            purchaseSucceded?.Invoke(count);
        }

        private bool CheckDailyBonusConditions()
        {
            DateTime today = DateTime.Today;
            DateTime lastRewardDate = DateTime.Parse(PlayerPrefs.GetString("DailyBonusDay", today.Subtract(TimeSpan.FromDays(1)).ToString(CultureInfo.CurrentCulture)));
            return today.Date > lastRewardDate.Date;
        }
    }
}