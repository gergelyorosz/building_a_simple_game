using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class CoinCounter : MonoBehaviour
{

    int totalCoins;

    // Start is called before the first frame update
    void Start()
    {
        
    }

    // Update is called once per frame
    void Update()
    {
        
    }

    public int TotalCoins
    {
        get
        {
            return totalCoins;
        }
        set
        {
            totalCoins = value;
            Debug.Log("The player is holding" + totalCoins + " coins");
        }
    }
}
