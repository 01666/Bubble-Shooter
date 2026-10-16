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

using System.Linq;
using BubbleShooterGameToolkit.Scripts.Audio;
using BubbleShooterGameToolkit.Scripts.CommonUI;
using BubbleShooterGameToolkit.Scripts.CommonUI.Popups;
using BubbleShooterGameToolkit.Scripts.Enums;
using BubbleShooterGameToolkit.Scripts.Gameplay.BubbleContainers;
using BubbleShooterGameToolkit.Scripts.Gameplay.Managers;
using BubbleShooterGameToolkit.Scripts.Settings;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace BubbleShooterGameToolkit.Scripts.Gameplay.Boosts
{
    ///Boost GUI class for boost icon in game and in menu
    public class BoostGUI : MonoBehaviour
    {
        [SerializeField]
        public BoostResource boostResource;
        [SerializeField] private TextMeshProUGUI guiCounter;
        [SerializeField] private GameObject checkObject; // the check icon game object
        [SerializeField] private GameObject lockObject; // the lock icon game object
        [SerializeField] private GameObject numberObject; // the boost number game object
        [SerializeField] private GameObject plusObject; // the plus icon game object
        [SerializeField] private GameObject roundObject; // the round icon game object
        [SerializeField] private Transform iconTransform; // the boost icon transform
        [SerializeField] private Button button; // the boost button
        
        [HideInInspector]
        // Boolean to store if the boost is selected
        public bool selected;
        [HideInInspector]
        public BoostParameters boostParameters;
        private BoostBallContainer boostBallContainer;

        private void UpdateGUI()
        {
            guiCounter.text = boostResource.GetResource().ToString();
            checkObject.SetActive(IsSelected() && !IsLocked());
            lockObject.SetActive(IsLocked());
            roundObject.SetActive(!IsLocked());
            iconTransform.gameObject.SetActive(!IsLocked());
            numberObject.SetActive(boostResource.IsEnough(1) && !IsSelected() && !IsLocked());
            plusObject.SetActive(!boostResource.IsEnough(1) && !IsSelected() && !IsLocked());
        }

        public bool IsSelected() => selected;

        void OnEnable()
        {
            boostBallContainer = GetComponent<BoostBallContainer>();
            var iconPrefab = Resources.Load<BoostSettings>("Settings/BoostSettings").boosts.First(i => i.boostResource == boostResource).iconPrefab;
            var icon = Instantiate(iconPrefab, iconTransform);
            var rectTransform = icon.GetComponent<RectTransform>();
            rectTransform.anchorMin = Vector2.zero;
            rectTransform.anchorMax = Vector2.one;
            rectTransform.offsetMin = Vector2.zero;
            rectTransform.offsetMax = Vector2.zero;
            UpdateGUI();
            EventManager.GetEvent<BoostResource>(EGameEvent.BoostActivated).Subscribe(Select);
            EventManager.GetEvent<BoostResource>(EGameEvent.BoostDeactivated).Subscribe(Deselect);
        }

        private void OnDisable()
        {
            EventManager.GetEvent<BoostResource>(EGameEvent.BoostActivated).Unsubscribe(Select);
            EventManager.GetEvent<BoostResource>(EGameEvent.BoostDeactivated).Unsubscribe(Deselect);
        }

        //spend boost from popup
        public void SpendBoostMenu()
        {
            BuyBoost();
        }
        
        //spend boost from play status
        public void SpendBoostPlay()
        {
            SpendBoost();
        }
        
        // Select the boost
        private void Select(BoostResource resource)
        {
            if(!IsSelected() && resource == boostResource)
            {
                selected = true;
            }
        }

        private void Deselect(BoostResource resource)
        {
            if (resource == boostResource)
            {
                selected = false;
                UpdateGUI();
            }
        }
        
        // Check if the boost is locked
        public bool IsLocked()
        {
            // Get the open level from the player prefs
            return PlayerPrefs.GetInt("OpenLevel", 1) < boostParameters.openLevel;
        }

        private void SpendBoost()
        {
            if(IsLocked() || EventManager.GameStatus != EStatus.Play)
                return;
            BuyBoost();
        }

        private void BuyBoost()
        {
            if(IsLocked())
                return;
            if (!boostResource.Activate(boostParameters))
            {
                button.interactable = false;
                var popup = MenuManager.instance.ShowPopup<BoostShop>();
                popup.SetBoost(boostParameters, OnBoostPurchased);
            }
            else
            {
                UpdateGUI();
                SoundBase.instance.PlaySound(SoundBase.instance.buyBoost);
                boostBallContainer?.ReleaseBoost(boostParameters.ballPrefab.name);
            }
        }

        private void OnBoostPurchased()
        {
            if(boostResource.Activate(boostParameters))
            {
                UpdateGUI();
                boostBallContainer?.ReleaseBoost(boostParameters.ballPrefab.name);
            }
        }

        private void Update()
        {
            button.interactable = !IsLocked() && !IsSelected();
        }
    }
}