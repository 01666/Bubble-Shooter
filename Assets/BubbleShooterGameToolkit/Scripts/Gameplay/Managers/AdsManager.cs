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
using BubbleShooterGameToolkit.Scripts.Ads.AdUnits;
using BubbleShooterGameToolkit.Scripts.CommonUI.Popups;
using BubbleShooterGameToolkit.Scripts.Settings;
using BubbleShooterGameToolkit.Scripts.System;
using UnityEngine;

namespace BubbleShooterGameToolkit.Scripts.Gameplay.Managers
{
    public class AdsManager : SingletonBehaviour<AdsManager>
    {
        private readonly List<AdSetting> adList = new();
        private readonly List<AdUnit> adUnits = new();
        private EPlatforms platforms;

        public override void Awake()
        {
            base.Awake();
            platforms = GetPlatform();
            var adElements = Resources.Load<AdsSettings>("Settings/AdsSettings").adProfiles;
            foreach (var t in adElements)
            {
                if (t.platforms == platforms && t.enable)
                {
                    if (Application.isEditor && !t.testInEditor)
                    {
                        continue;
                    }

                    adList.Add(t);
                    foreach (var adElement in t.adElements)
                    {
                        var adUnit = new AdUnit { PlacementId = adElement.placementId, AdReference = adElement.adReference, AdsHandler = t.adsHandler };
                        adUnit.OnInitialized = placementId => adUnit.Load();
                        adUnits.Add(adUnit);
                    }

                    t.adsHandler.Init(t.appId, false, new AdsListener(adUnits));
                }
            }
        }

        private void OnEnable()
        {
            Popup.OnOpenPopup += OnOpenPopup;
            Popup.OnClosePopup += OnClosePopup;
        }

        private void OnDisable()
        {
            Popup.OnOpenPopup -= OnOpenPopup;
            Popup.OnClosePopup -= OnClosePopup;
        }

        private EPlatforms GetPlatform()
        {
            #if UNITY_ANDROID
            return EPlatforms.Android;
            #elif UNITY_IOS
            return EPlatforms.IOS;
            #elif UNITY_WEBGL
            return EPlatforms.WebGL;
            #else
            return EPlatforms.Windows;
            #endif
        }

        private void OnOpenPopup(Popup popup)
        {
            OnPopupTrigger(popup, true);
        }

        private void OnClosePopup(Popup popup)
        {
            OnPopupTrigger(popup, false);
        }

        private void OnPopupTrigger(Popup popup, bool open)
        {
            foreach (var ad in adList)
            {
                foreach (var adElement in ad.adElements)
                {
                    var adUnit = adUnits.Find(i => i.AdReference == adElement.adReference);
                    if (!adUnit.IsAvailable())
                    {
                        adUnit.Load();
                        continue;
                    }

                    if (((open && adElement.popup.showOnOpen) || (!open && adElement.popup.showOnClose)) && popup.GetType() == adElement.popup.popup.GetType())
                    {
                        adUnit.Show();
                        adUnit.Load();
                        return;
                    }
                }
            }
        }

        public void ShowAdByType(AdReference adRef, Action<string> shown)
        {
            foreach (var adUnit in adUnits)
            {
                if (adUnit.AdReference == adRef && adUnit.IsAvailable())
                {
                    adUnit.OnShown = shown;
                    adUnit.Show();
                    // adUnit.Load();
                    return;
                }
            }
        }

        public bool IsRewardedAvailable(AdReference adRef)
        {
            foreach (var adUnit in adUnits)
            {
                if (adUnit.AdReference == adRef)
                {
                    return adUnit.IsAvailable();
                }
            }

            return false;
        }
    }

}