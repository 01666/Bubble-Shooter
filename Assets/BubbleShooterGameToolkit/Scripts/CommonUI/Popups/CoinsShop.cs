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
using BubbleShooterGameToolkit.Scripts.Services;
using BubbleShooterGameToolkit.Scripts.Settings;
using BubbleShooterGameToolkit.Scripts.System;
using UnityEngine;

namespace BubbleShooterGameToolkit.Scripts.CommonUI.Popups
{
    public class CoinsShop : PopupWithCurrencyLabel
    {
        public ItemPurchase[] packs;
        private ShopSettings shopSettings;
        private void OnEnable()
        {
            shopSettings = Resources.Load<ShopSettings>("Settings/ShopSettings");
            for (int i = 0; i < packs.Length; i++)
            {
                packs[i].settingsShopItem = shopSettings.shopItems[i];
                packs[i].count.text = packs[i].settingsShopItem.coins.ToString();
                var discountPercent = packs[i].discountPercent; 
                if (discountPercent != null)
                {
                    discountPercent.text = packs[i].settingsShopItem.discountPercent.ToString();
                }
            }
            GameManager.instance.purchaseSucceded += PurchaseSucceded;

        }
        
        private void OnDisable()
        {
            GameManager.instance.purchaseSucceded -= PurchaseSucceded;
        }
        
        private void PurchaseSucceded(int count)
        {
            topPanel.AnimateCoins(packs.First(i=>i.settingsShopItem.coins == count).BuyItemButton.transform.position, "+"+count, GetComponentInParent<Popup>().Close);
        }

        public void BuyCoins(string id)
        {
            #if UNITY_WEBPLAYER
            GameManager.instance.PurchaseSucceded(id);
            #else
            IAPManager.instance.BuyProduct(id);
            #endif
        }
    }
}