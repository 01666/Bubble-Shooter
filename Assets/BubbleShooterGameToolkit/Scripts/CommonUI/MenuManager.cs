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
using BubbleShooterGameToolkit.Scripts.CommonUI.Popups;
using BubbleShooterGameToolkit.Scripts.System;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace BubbleShooterGameToolkit.Scripts.CommonUI
{
    public class MenuManager : SingletonBehaviour<MenuManager>
    {
        public Fader fader;
        private List<Popup> popupStack = new();
        [SerializeField]
        private Canvas canvas;

        public override void Awake()
        {
            base.Awake();
            DontDestroyOnLoad(this);
        }

        private void OnEnable()
        {
            fader.FadeAfterLoadingScene();
            Popup.OnClosePopup += ClosePopup;
            SceneLoader.OnSceneLoadedCallback += OnSceneLoaded;
        }

        private void OnSceneLoaded(Scene scene)
        {
            // Check if the canvas is null
            if (canvas == null && this != null)
            {
                // Find the canvas in the scene
                canvas = GetComponent<Canvas>();
            }

            canvas.worldCamera = Camera.main;
        }

        private void OnDisable()
        {
            Popup.OnClosePopup -= ClosePopup;
            SceneLoader.OnSceneLoadedCallback -= OnSceneLoaded;
        }

        public T ShowPopup<T>(Action onShow = null, Action<EPopupResult> onClose = null) where T : Popup
        {
            T popupPrefab = Resources.Load<T>("Popups/" + typeof(T).Name);
            
            var popup = Instantiate<T>(popupPrefab, transform);

            if (popup == null)
            {
                Debug.LogError("Popup prefab not found in Resources folder: " + typeof(T).Name);
                return null;
            }

            if (popupStack.Count > 0 )
            {
                popupStack.Last().Hide();
            }
            popupStack.Add(popup);
            popup.Show<T>(onShow, onClose);
            var rectTransform = popup.GetComponent<RectTransform>();
            rectTransform.anchoredPosition = Vector2.zero;
            rectTransform.sizeDelta = Vector2.zero;
            if(fader != null && popupStack.Count > 0 && popup.fade)
                fader.FadeIn();
            return popup;
        }

        private void ClosePopup(Popup popupClose)
        {
            if (popupStack.Count > 0)
            {
                popupStack.Remove(popupClose);
                if (popupStack.Count > 0)
                {
                    var popup = popupStack.Last();
                    popup.Show();
                }
            }
            if(fader != null && popupStack.Count == 0 && fader.IsFaded())
                fader.FadeOut();
        }

        public void ShowPurchased(GameObject imagePrefab, string boostName)
        {
            var menu = ShowPopup<PurchasedMenu>();
            menu.GetComponent<PurchasedMenu>().SetIconSprite(imagePrefab, boostName);
        }

        void Update()
        {
            if (Application.platform != RuntimePlatform.IPhonePlayer) {
                if (Input.GetKeyUp(KeyCode.Escape))
                {
                    if (popupStack is { Count: > 0 })
                    {
                        var closeButton = popupStack.Last().closeButton;
                        if (closeButton != null)
                        {
                            closeButton.onClick?.Invoke();
                        }
                    }
                    else if (SceneManager.GetActiveScene().name == "map")
                    {
                        SceneLoader.instance.GoMain();
                    }
                }
            }
        }

        public T GetPopupOpened<T>() where T : Popup
        {
            foreach (var popup in popupStack)
            {
                if (popup.GetType() == typeof(T))
                    return (T)popup;
            }
            return null;
        }

        public void CloseAllPopups()
        {
            for (var i = 0; i < popupStack.Count; i++)
            {
                var popup = popupStack[i];
                popup.Close();
            }
            popupStack.Clear();
        }

    }
}
